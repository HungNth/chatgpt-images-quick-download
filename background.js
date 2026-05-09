if (typeof importScripts === "function" && !globalThis.ChatGPTImagesDownloader) {
  importScripts("src/imageTargets.js");
}

const helpers = globalThis.ChatGPTImagesDownloader;
const SAFE_FILENAME_PATTERN = /^chatgpt-image-\d{8}-\d{6}-\d{3}\.(?:png|jpe?g|webp|gif|avif)$/i;
const GENERIC_DOWNLOAD_MIME_TYPES = new Set(["application/octet-stream", "binary/octet-stream"]);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "CGQID_DOWNLOAD") return false;

  const { url, filename } = message;
  if (!url || !filename) {
    sendResponse({ ok: false, error: "Missing image URL or filename." });
    return false;
  }

  if (!isSupportedSender(_sender)) {
    sendResponse({ ok: false, error: "Downloads are only allowed from supported ChatGPT pages." });
    return false;
  }

  downloadAndWait(url, filename).then(sendResponse);

  return true;
});

async function downloadAndWait(url, filename) {
  const validation = validateDownloadRequest(url, filename);
  if (!validation.ok) return validation;

  const downloadId = await new Promise((resolve) => {
    chrome.downloads.download(
      {
        url,
        filename: `ChatGPT Images/${filename}`,
        conflictAction: "uniquify",
        saveAs: false
      },
      (id) => resolve({ id, error: chrome.runtime.lastError?.message || "" })
    );
  });

  if (downloadId.error || !downloadId.id) {
    return { ok: false, error: downloadId.error || "Chrome did not create a download." };
  }

  return waitForDownload(downloadId.id);
}

function validateDownloadRequest(url, filename) {
  if (!helpers?.isPossiblyDownloadableImageUrl?.(url)) {
    return { ok: false, error: "Image URL is not allowed." };
  }

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Background downloads require an http(s) image URL." };
  }

  if (!SAFE_FILENAME_PATTERN.test(String(filename || ""))) {
    return { ok: false, error: "Unsafe download filename." };
  }

  return { ok: true };
}

function isSupportedSender(sender) {
  if (!sender?.tab?.url) return true;

  try {
    return Boolean(helpers?.isSupportedChatGPTSurface?.(new URL(sender.tab.url)));
  } catch {
    return false;
  }
}

function waitForDownload(downloadId) {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => finish({ ok: true, downloadId, pending: true }), 60000);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve(result);
    }

    function onChanged(delta) {
      if (delta.id !== downloadId) return;

      if (delta.state?.current === "complete") {
        chrome.downloads.search({ id: downloadId }, ([download] = []) => {
          if (!isImageDownload(download)) {
            removeDownload(downloadId, () => {
              finish({
                ok: false,
                downloadId,
                error: "Downloaded file was not an image.",
                mime: download?.mime || ""
              });
            });
            return;
          }

          finish({ ok: true, downloadId, filename: download?.filename || "" });
        });
      } else if (delta.state?.current === "interrupted") {
        chrome.downloads.search({ id: downloadId }, ([download] = []) => {
          finish({
            ok: false,
            downloadId,
            error: download?.error || download?.interruptReason || "Download interrupted."
          });
        });
      }
    }

    chrome.downloads.onChanged.addListener(onChanged);
  });
}

function isImageDownload(download) {
  const mime = String(download?.mime || "").toLowerCase();
  const filename = String(download?.filename || download?.url || "").toLowerCase();

  if (mime.startsWith("image/")) return true;
  if (mime && !GENERIC_DOWNLOAD_MIME_TYPES.has(mime)) return false;
  return /\.(?:png|jpe?g|webp|gif|avif)(?:[?#].*)?$/.test(filename);
}

function removeDownload(downloadId, callback) {
  let pending = 2;

  function done() {
    pending -= 1;
    if (pending <= 0) callback();
  }

  chrome.downloads.removeFile(downloadId, done);
  chrome.downloads.erase({ id: downloadId }, done);
}
