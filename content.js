(function chatGPTImagesQuickDownload() {
  const helpers = globalThis.ChatGPTImagesDownloader;
  if (!helpers) return;

  const DECORATED_ATTR = "data-cgqid-decorated";
  const HOST_ATTR = "data-cgqid-host";
  const DOWNLOAD_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 19h14" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>
  `;

  let scanQueued = false;
  let latestPath = location.pathname;
  let toastTimer;

  function isImagesPage() {
    return location.hostname === "chatgpt.com" && location.pathname.startsWith("/images");
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;

    const run = () => {
      scanQueued = false;
      scanImages();
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(run);
    } else if (window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 0);
    }
  }

  function scanImages() {
    if (!isImagesPage()) return;

    const root = document.querySelector("main") || document.querySelector('[role="main"]') || document.body;
    const images = Array.from(root.querySelectorAll("img:not([" + DECORATED_ATTR + "])"));
    let decorated = 0;

    for (const image of images) {
      if (!shouldDecorate(image)) continue;
      decorateImage(image);
      decorated += 1;
    }

    if (decorated) {
      document.documentElement.dataset.cgqidReady = "true";
    }
  }

  function shouldDecorate(image) {
    const rect = image.getBoundingClientRect();
    const inNavigation = Boolean(image.closest("nav, aside, [role='navigation'], [aria-label*='sidebar' i]"));
    const url = helpers.chooseBestImageUrl(image);

    return Boolean(
      url &&
        helpers.isLikelyTargetImage({
          width: rect.width,
          height: rect.height,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          inNavigation
        })
    );
  }

  function decorateImage(image) {
    const host = findHost(image);
    if (!host) return;

    image.setAttribute(DECORATED_ATTR, "true");
    host.setAttribute(HOST_ATTR, "true");
    host.classList.add("cgqid-host");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cgqid-button";
    button.setAttribute("aria-label", "Download this image");
    button.title = "Download this image";
    button.innerHTML = DOWNLOAD_ICON;

    button.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        await downloadImage(image, button);
      },
      true
    );

    host.appendChild(button);
  }

  function findHost(image) {
    let node = image.parentElement;
    let depth = 0;
    const imageRect = image.getBoundingClientRect();

    while (node && node !== document.body && depth < 5) {
      if (node instanceof HTMLElement && !["SOURCE"].includes(node.tagName)) {
        const rect = node.getBoundingClientRect();
        const widthRatio = rect.width / Math.max(1, imageRect.width);
        const heightRatio = rect.height / Math.max(1, imageRect.height);

        if (widthRatio >= 0.9 && heightRatio >= 0.9 && widthRatio <= 2.4 && heightRatio <= 2.4) {
          return node;
        }
      }

      node = node.parentElement;
      depth += 1;
    }

    return image.parentElement instanceof HTMLElement ? image.parentElement : null;
  }

  async function downloadImage(image, button) {
    const host = image.closest(`[${HOST_ATTR}]`) || findHost(image);
    const urls = helpers.rankDownloadUrls({
      imageLike: image,
      candidateUrls: collectCandidateUrls(host || image)
    });
    if (!urls.length) {
      showToast("No downloadable image URL found.");
      return;
    }

    button?.classList.add("cgqid-busy");

    try {
      const nativeDownloaded = await downloadViaNativeViewer(image, host);
      if (nativeDownloaded) {
        showToast("Full-size image download started.");
        return;
      }

      const index = getVisibleTargetImages().indexOf(image) + 1 || 1;

      for (const url of urls) {
        const filename = helpers.buildDownloadFilename({ url, index });
        const downloaded = await tryDownloadUrl(url, filename);
        if (downloaded) {
          showToast("Image download started.");
          return;
        }
      }

      throw new Error("Chrome could not download any candidate image URL.");
    } catch (error) {
      console.warn("[ChatGPT Images Quick Download]", error);
      showToast("Could not download this image.");
    } finally {
      button?.classList.remove("cgqid-busy");
    }
  }

  async function downloadViaNativeViewer(image, host) {
    const openButton = findNativeOpenButton(image, host);
    if (!openButton) return false;

    openButton.click();

    const saveButton = await waitForElement(findNativeSaveButton, 5000);
    if (!saveButton) {
      closeNativeViewer();
      return false;
    }

    saveButton.click();
    await wait(1200);
    closeNativeViewer();

    return true;
  }

  function findNativeOpenButton(image, host) {
    const roots = helpers.uniqueElements([
      host,
      image.closest?.("button"),
      host?.parentElement,
      image.parentElement,
      image.parentElement?.parentElement
    ]);

    for (const root of roots) {
      const buttons = helpers.uniqueElements([
        root instanceof HTMLButtonElement ? root : null,
        ...Array.from(root?.querySelectorAll?.("button") || [])
      ]);
      const openButton = buttons.find((button) => {
        return !button.classList.contains("cgqid-button") && helpers.isNativeOpenImageControl(button);
      });

      if (openButton) return openButton;
    }

    return null;
  }

  function findNativeSaveButton() {
    return Array.from(document.querySelectorAll("button")).find((button) => {
      return !button.disabled && !button.classList.contains("cgqid-button") && helpers.isNativeSaveControl(button);
    });
  }

  function closeNativeViewer() {
    const closeButton = Array.from(document.querySelectorAll("button")).find((button) => {
      return !button.disabled && helpers.isNativeCloseViewerControl(button);
    });

    closeButton?.click();
  }

  function waitForElement(getElement, timeout = 3000) {
    const started = Date.now();

    return new Promise((resolve) => {
      const tick = () => {
        const element = getElement();
        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - started >= timeout) {
          resolve(null);
          return;
        }

        window.setTimeout(tick, 80);
      };

      tick();
    });
  }

  async function tryDownloadUrl(url, filename) {
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      downloadInPage(url, filename);
      return true;
    }

    const response = await chrome.runtime.sendMessage({
      type: "CGQID_DOWNLOAD",
      url,
      filename
    });

    return Boolean(response?.ok);
  }

  function downloadInPage(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
  }

  function getVisibleTargetImages() {
    return Array.from(document.querySelectorAll(`img[${DECORATED_ATTR}="true"]`)).filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
    });
  }

  function getStatus() {
    const all = Array.from(document.querySelectorAll(`img[${DECORATED_ATTR}="true"]`));
    return {
      isImagesPage: isImagesPage(),
      decoratedCount: all.length,
      visibleCount: getVisibleTargetImages().length
    };
  }

  async function downloadVisibleImages() {
    const images = getVisibleTargetImages();
    const urls = helpers.uniqueUrls(
      images.map((image) => {
        const host = image.closest(`[${HOST_ATTR}]`) || findHost(image);
        return helpers.rankDownloadUrls({
          imageLike: image,
          candidateUrls: collectCandidateUrls(host || image)
        })[0];
      })
    );

    for (const [index, url] of urls.entries()) {
      const filename = helpers.buildDownloadFilename({ url, index: index + 1 });

      if (url.startsWith("blob:") || url.startsWith("data:")) {
        downloadInPage(url, filename);
      } else {
        await chrome.runtime.sendMessage({ type: "CGQID_DOWNLOAD", url, filename });
      }

      await wait(140);
    }

    showToast(urls.length ? `Started ${urls.length} downloads.` : "No visible images found.");
    return { downloaded: urls.length };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function collectCandidateUrls(root) {
    const urls = [];
    const elements = [root, ...Array.from(root?.querySelectorAll?.("*") || [])].filter(Boolean);

    for (const element of elements) {
      if (element.closest?.(".cgqid-button, .cgqid-toast")) continue;

      for (const attr of element.attributes || []) {
        if (!helpers.isCandidateUrlAttribute(attr.name, attr.value)) continue;
        collectUrlsFromText(attr.value, urls);
      }

      if (element instanceof HTMLImageElement) {
        urls.push(element.currentSrc, element.src);
        collectUrlsFromText(element.srcset, urls);
      }

      if (element instanceof HTMLSourceElement) {
        urls.push(element.src);
        collectUrlsFromText(element.srcset, urls);
      }

      const background = getComputedStyle(element).backgroundImage;
      collectUrlsFromText(background, urls);
    }

    return helpers.uniqueUrls(urls);
  }

  function collectUrlsFromText(text, urls) {
    if (!text || typeof text !== "string") return;

    const srcsetParts = text
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter((part) => /^https?:\/\//i.test(part));

    urls.push(...srcsetParts);

    const urlMatches = text.match(/https?:\/\/[^"'\\s,)]+/gi) || [];
    urls.push(...urlMatches.map((url) => url.replace(/&amp;/g, "&")));

    const cssMatches = [...text.matchAll(/url\\((['"]?)(.*?)\\1\\)/gi)];
    urls.push(...cssMatches.map((match) => match[2]).filter((url) => /^https?:\/\//i.test(url)));
  }

  function showToast(message) {
    let toast = document.querySelector(".cgqid-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "cgqid-toast";
      document.documentElement.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("cgqid-toast-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("cgqid-toast-visible"), 1700);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return false;

    if (message.type === "CGQID_GET_STATUS") {
      queueScan();
      sendResponse(getStatus());
      return false;
    }

    if (message.type === "CGQID_RESCAN") {
      scanImages();
      sendResponse(getStatus());
      return false;
    }

    if (message.type === "CGQID_DOWNLOAD_VISIBLE") {
      downloadVisibleImages().then(sendResponse);
      return true;
    }

    return false;
  });

  const observer = new MutationObserver(queueScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("scroll", queueScan, { passive: true });
  window.addEventListener("resize", queueScan, { passive: true });

  window.setInterval(() => {
    if (latestPath !== location.pathname) {
      latestPath = location.pathname;
      queueScan();
    }
  }, 800);

  queueScan();
})();
