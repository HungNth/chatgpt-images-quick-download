(function attachImageTargetHelpers(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ChatGPTImagesDownloader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function imageTargetFactory() {
  const FALLBACK_EXTENSION = "png";
  const MIN_VISIBLE_SIDE = 128;
  const URL_PARAM_NAMES = ["url", "src", "image", "image_url", "media"];
  const URL_ATTRIBUTE_NAMES = new Set([
    "src",
    "srcset",
    "href",
    "poster",
    "style",
    "data-src",
    "data-srcset",
    "data-url",
    "data-image",
    "data-image-url",
    "data-original",
    "data-full",
    "data-media",
    "data-thumbnail"
  ]);
  const BLOCKED_ATTRIBUTE_NAMES = new Set(["class", "id", "role", "title", "type", "xmlns"]);
  const NON_IMAGE_EXTENSIONS = new Set([
    "css",
    "html",
    "js",
    "json",
    "map",
    "mjs",
    "pdf",
    "svg",
    "txt",
    "xml"
  ]);

  function parseSrcset(srcset) {
    if (!srcset || typeof srcset !== "string") return [];

    return srcset
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [url, descriptor = "1x"] = item.split(/\s+/);
        const widthMatch = descriptor.match(/^(\d+(?:\.\d+)?)w$/);
        const densityMatch = descriptor.match(/^(\d+(?:\.\d+)?)x$/);
        const score = widthMatch
          ? Number(widthMatch[1])
          : densityMatch
            ? Number(densityMatch[1]) * 1000
            : 1;

        return { url, score };
      })
      .filter((candidate) => Boolean(candidate.url));
  }

  function chooseBestImageUrl(imageLike) {
    if (!imageLike) return "";

    const srcsetCandidates = parseSrcset(imageLike.srcset);
    if (srcsetCandidates.length) {
      srcsetCandidates.sort((a, b) => b.score - a.score);
      return srcsetCandidates[0].url;
    }

    return imageLike.currentSrc || imageLike.src || "";
  }

  function chooseBestDownloadUrl({ imageLike, candidateUrls = [] } = {}) {
    return rankDownloadUrls({ imageLike, candidateUrls })[0] || "";
  }

  function rankDownloadUrls({ imageLike, candidateUrls = [] } = {}) {
    const renderedUrl = chooseBestImageUrl(imageLike);
    const normalized = uniqueUrls([renderedUrl, ...candidateUrls].flatMap(expandDownloadCandidates)).filter(
      isPossiblyDownloadableImageUrl
    );
    if (!normalized.length) return [];

    normalized.sort((a, b) => scoreDownloadUrl(b, renderedUrl) - scoreDownloadUrl(a, renderedUrl));
    return normalized;
  }

  function expandDownloadCandidates(url) {
    const normalized = normalizeCandidateUrl(url);
    if (!normalized) return [];

    const candidates = [normalized];
    const fullSizeUrl = getEstuaryFullSizeUrl(normalized);
    if (fullSizeUrl) candidates.unshift(fullSizeUrl);

    return candidates;
  }

  function getEstuaryFullSizeUrl(url) {
    try {
      const parsed = new URL(url, "https://chatgpt.com");
      if (parsed.hostname !== "chatgpt.com" || parsed.pathname !== "/backend-api/estuary/content") return "";

      const id = parsed.searchParams.get("id");
      if (!id?.endsWith("#thumbnail")) return "";

      parsed.searchParams.set("id", id.slice(0, -"#thumbnail".length));
      return parsed.href;
    } catch {
      return "";
    }
  }

  function normalizeCandidateUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

    try {
      const parsed = new URL(trimmed, "https://chatgpt.com");

      for (const param of URL_PARAM_NAMES) {
        const embedded = parsed.searchParams.get(param);
        if (embedded && /^https?:\/\//i.test(embedded)) {
          return normalizeCandidateUrl(embedded);
        }
      }

      return parsed.href;
    } catch {
      return trimmed;
    }
  }

  function scoreDownloadUrl(url, renderedUrl = "") {
    if (!url || !isPossiblyDownloadableImageUrl(url)) return -Infinity;
    if (url.startsWith("data:")) return 10;
    if (url.startsWith("blob:")) return 20;

    let score = 100;
    let parsed;

    try {
      parsed = new URL(url, "https://chatgpt.com");
    } catch {
      return score;
    }

    const haystack = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
    const extension = getImageExtension(url);
    if (extension !== FALLBACK_EXTENSION || /\.png|\.jpe?g|\.webp|\.avif|\.gif/i.test(parsed.pathname)) score += 20;
    if (/original|full|fullsize|generated|final|download|asset/.test(haystack)) score += 360;
    if (/\/backend-api\/estuary\/content/.test(haystack) && !/%23thumbnail|#thumbnail/.test(haystack)) score += 420;
    if (/thumb|thumbnail|preview|small|lowres|blur|placeholder|avatar/.test(haystack)) score -= 80;

    const width = Number(parsed.searchParams.get("width") || parsed.searchParams.get("w") || 0);
    const height = Number(parsed.searchParams.get("height") || parsed.searchParams.get("h") || 0);
    const quality = Number(parsed.searchParams.get("quality") || parsed.searchParams.get("q") || 0);

    score += Math.min(width || 0, 4096) / 8;
    score += Math.min(height || 0, 4096) / 10;
    score += Math.min(quality || 0, 100) / 2;

    if (width && width <= 640) score -= 80;
    if (height && height <= 640) score -= 50;
    if (quality && quality < 80) score -= 30;
    if (normalizeCandidateUrl(renderedUrl) === url) score -= 35;

    return score;
  }

  function isPossiblyDownloadableImageUrl(url) {
    if (!url || typeof url !== "string") return false;
    if (/^data:image\//i.test(url)) return true;
    if (url.startsWith("blob:")) return true;

    try {
      const parsed = new URL(url, "https://chatgpt.com");
      const pathname = parsed.pathname.toLowerCase();
      const extension = pathname.match(/\.([a-z0-9]+)$/)?.[1] || "";

      if (parsed.hostname === "w3.org" || parsed.hostname.endsWith(".w3.org")) return false;
      if (NON_IMAGE_EXTENSIONS.has(extension)) return false;
      if (pathname === "/backend-api/e") return false;
      if (pathname === "/2000/svg") return false;
      if (pathname.startsWith("/_next/static/")) return false;
      if (pathname.startsWith("/static/")) return false;

      return true;
    } catch {
      return !/\.(?:css|html?|js|json|map|mjs|txt|xml)(?:[?#]|$)/i.test(url);
    }
  }

  function isCandidateUrlAttribute(name, value = "") {
    const attrName = String(name || "").toLowerCase();
    const attrValue = String(value || "");

    if (!attrName || attrName.startsWith("aria-") || BLOCKED_ATTRIBUTE_NAMES.has(attrName)) return false;
    if (!/https?:\/\//i.test(attrValue) && !/^data:image\//i.test(attrValue)) return false;
    if (URL_ATTRIBUTE_NAMES.has(attrName)) return true;

    return attrName.startsWith("data-") && /(?:src|srcset|url|image|media|poster|thumbnail|original|full)/i.test(attrName);
  }

  function getControlLabel(control) {
    if (!control) return "";

    const readAttribute = typeof control.getAttribute === "function" ? control.getAttribute.bind(control) : () => "";
    return [readAttribute("aria-label"), readAttribute("title"), control.textContent]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isNativeOpenImageControl(control) {
    return /^(open image:|open image in full view$)/i.test(getControlLabel(control));
  }

  function isNativeSaveControl(control) {
    return /^save$/i.test(getControlLabel(control));
  }

  function isNativeCloseViewerControl(control) {
    return /close fullscreen view/i.test(getControlLabel(control));
  }

  function getImageExtension(url) {
    if (!url || typeof url !== "string") return FALLBACK_EXTENSION;

    const dataMime = url.match(/^data:image\/([a-zA-Z0-9.+-]+);/);
    if (dataMime) return normalizeExtension(dataMime[1]);
    if (url.startsWith("blob:")) return FALLBACK_EXTENSION;

    try {
      const parsed = new URL(url, "https://chatgpt.com");
      const ext = parsed.pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1];
      return normalizeExtension(ext);
    } catch {
      return FALLBACK_EXTENSION;
    }
  }

  function normalizeExtension(extension) {
    const clean = String(extension || "").toLowerCase();
    if (clean === "jpeg" || clean === "pjpeg") return "jpg";
    if (["png", "jpg", "webp", "gif", "avif"].includes(clean)) return clean;
    return FALLBACK_EXTENSION;
  }

  function buildDownloadFilename({ url, index = 1, now = new Date() } = {}) {
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "")
      .replace("T", "-");
    const number = String(Math.max(1, index)).padStart(3, "0");
    const extension = getImageExtension(url);

    return `chatgpt-image-${timestamp}-${number}.${extension}`;
  }

  function uniqueUrls(urls) {
    const seen = new Set();
    const output = [];

    for (const url of urls || []) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      output.push(url);
    }

    return output;
  }

  function uniqueElements(elements) {
    const seen = new Set();
    const output = [];

    for (const element of elements || []) {
      if (!element || seen.has(element)) continue;
      seen.add(element);
      output.push(element);
    }

    return output;
  }

  function isLikelyTargetImage(metrics) {
    if (!metrics || metrics.inNavigation) return false;

    const width = Number(metrics.width || 0);
    const height = Number(metrics.height || 0);
    const naturalWidth = Number(metrics.naturalWidth || 0);
    const naturalHeight = Number(metrics.naturalHeight || 0);

    if (width < MIN_VISIBLE_SIDE || height < MIN_VISIBLE_SIDE) return false;
    if (naturalWidth && naturalWidth < MIN_VISIBLE_SIDE) return false;
    if (naturalHeight && naturalHeight < MIN_VISIBLE_SIDE) return false;

    return true;
  }

  function isSupportedChatGPTSurface(locationLike = {}) {
    const hostname = String(locationLike.hostname || "");
    const pathname = String(locationLike.pathname || "");

    return hostname === "chatgpt.com" && (pathname.startsWith("/images") || pathname.startsWith("/c/"));
  }

  return {
    buildDownloadFilename,
    chooseBestDownloadUrl,
    chooseBestImageUrl,
    getControlLabel,
    getImageExtension,
    isCandidateUrlAttribute,
    isNativeCloseViewerControl,
    isNativeOpenImageControl,
    isNativeSaveControl,
    isSupportedChatGPTSurface,
    isLikelyTargetImage,
    isPossiblyDownloadableImageUrl,
    normalizeCandidateUrl,
    parseSrcset,
    rankDownloadUrls,
    scoreDownloadUrl,
    uniqueElements,
    uniqueUrls
  };
});
