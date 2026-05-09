const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDownloadFilename,
  chooseBestDownloadUrl,
  chooseBestImageUrl,
  getImageExtension,
  getControlLabel,
  isCandidateUrlAttribute,
  isNativeCloseViewerControl,
  isNativeOpenImageControl,
  isNativeSaveControl,
  isSupportedChatGPTSurface,
  isPossiblyDownloadableImageUrl,
  isLikelyTargetImage,
  rankDownloadUrls,
  uniqueElements,
  uniqueUrls
} = require("../src/imageTargets.js");

test("chooseBestImageUrl picks the largest srcset candidate over thumbnail src", () => {
  const url = chooseBestImageUrl({
    currentSrc: "https://cdn.example.com/thumb.webp",
    src: "https://cdn.example.com/fallback.webp",
    srcset:
      "https://cdn.example.com/small.webp 320w, https://cdn.example.com/large.png 1536w, https://cdn.example.com/medium.webp 768w"
  });

  assert.equal(url, "https://cdn.example.com/large.png");
});

test("chooseBestImageUrl keeps currentSrc when no stronger candidate exists", () => {
  assert.equal(
    chooseBestImageUrl({
      currentSrc: "https://cdn.example.com/current.webp",
      src: "https://cdn.example.com/src.webp",
      srcset: ""
    }),
    "https://cdn.example.com/current.webp"
  );
});

test("chooseBestDownloadUrl prefers a nearby original asset over the rendered thumbnail", () => {
  const url = chooseBestDownloadUrl({
    imageLike: {
      currentSrc: "https://images.example.com/file_abc.webp?width=384&quality=70",
      src: "https://images.example.com/file_abc.webp?width=384&quality=70",
      srcset: ""
    },
    candidateUrls: [
      "https://images.example.com/file_abc.webp?width=384&quality=70",
      "https://images.example.com/file_abc.png?width=2048&quality=100",
      "https://images.example.com/file_abc_original.png"
    ]
  });

  assert.equal(url, "https://images.example.com/file_abc_original.png");
});

test("chooseBestDownloadUrl extracts full-size URL from encoded image proxy URLs", () => {
  const url = chooseBestDownloadUrl({
    imageLike: {
      currentSrc:
        "https://chatgpt.com/_next/image?url=https%3A%2F%2Fimages.example.com%2Fthumb.webp%3Fwidth%3D512&w=640&q=75",
      srcset: ""
    },
    candidateUrls: [
      "https://chatgpt.com/_next/image?url=https%3A%2F%2Fimages.example.com%2Fgenerated-final.png%3Fwidth%3D2048&w=2048&q=100"
    ]
  });

  assert.equal(url, "https://images.example.com/generated-final.png?width=2048");
});

test("rankDownloadUrls rejects non-image backend data and expands ChatGPT estuary thumbnails", () => {
  const thumbnail =
    "https://chatgpt.com/backend-api/estuary/content?id=abc%23file_123%23thumbnail&cp=pri&sig=token";
  const full = "https://chatgpt.com/backend-api/estuary/content?id=abc%23file_123&cp=pri&sig=token";

  assert.equal(isPossiblyDownloadableImageUrl("https://chatgpt.com/backend-api/e"), false);
  assert.deepEqual(
    rankDownloadUrls({
      imageLike: { currentSrc: thumbnail, srcset: "" },
      candidateUrls: ["https://chatgpt.com/backend-api/e", thumbnail]
    }),
    [full, thumbnail]
  );
});

test("rankDownloadUrls rejects SVG namespace URLs from injected controls", () => {
  assert.equal(isPossiblyDownloadableImageUrl("https://www.w3.org/2000/svg"), false);
  assert.deepEqual(
    rankDownloadUrls({
      imageLike: { currentSrc: "https://images.example.com/image.png", srcset: "" },
      candidateUrls: ["http://www.w3.org/2000/svg", "https://www.w3.org/2000/svg"]
    }),
    ["https://images.example.com/image.png"]
  );
});

test("isCandidateUrlAttribute keeps image-bearing attributes and rejects control metadata", () => {
  assert.equal(isCandidateUrlAttribute("src", "https://images.example.com/image.png"), true);
  assert.equal(isCandidateUrlAttribute("data-image-url", "https://images.example.com/full.png"), true);
  assert.equal(isCandidateUrlAttribute("style", "background-image: url(https://images.example.com/full.png)"), true);
  assert.equal(isCandidateUrlAttribute("xmlns", "http://www.w3.org/2000/svg"), false);
  assert.equal(isCandidateUrlAttribute("aria-label", "Download this image"), false);
  assert.equal(isCandidateUrlAttribute("class", "cgqid-button"), false);
});

test("native ChatGPT image controls are identified by accessible labels", () => {
  const control = ({ ariaLabel = "", title = "", textContent = "" }) => ({
    getAttribute(name) {
      if (name === "aria-label") return ariaLabel;
      if (name === "title") return title;
      return "";
    },
    textContent
  });

  assert.equal(getControlLabel(control({ ariaLabel: "Open image: Cozy night in a rustic corner" })), "Open image: Cozy night in a rustic corner");
  assert.equal(isNativeOpenImageControl(control({ ariaLabel: "Open image: Cozy night in a rustic corner" })), true);
  assert.equal(isNativeOpenImageControl(control({ ariaLabel: "Open image in full view" })), true);
  assert.equal(isNativeSaveControl(control({ ariaLabel: "Save" })), true);
  assert.equal(isNativeSaveControl(control({ textContent: "Save" })), true);
  assert.equal(isNativeCloseViewerControl(control({ ariaLabel: "Close fullscreen view" })), true);
  assert.equal(isNativeSaveControl(control({ ariaLabel: "Download this image" })), false);
});

test("supported ChatGPT surfaces include images and conversation pages only", () => {
  assert.equal(isSupportedChatGPTSurface({ hostname: "chatgpt.com", pathname: "/images" }), true);
  assert.equal(isSupportedChatGPTSurface({ hostname: "chatgpt.com", pathname: "/images/" }), true);
  assert.equal(isSupportedChatGPTSurface({ hostname: "chatgpt.com", pathname: "/c/69ff1bf0-5948-83a6-9056-1afd5256decf" }), true);
  assert.equal(isSupportedChatGPTSurface({ hostname: "chatgpt.com", pathname: "/" }), false);
  assert.equal(isSupportedChatGPTSurface({ hostname: "example.com", pathname: "/c/69ff1bf0" }), false);
});

test("getImageExtension handles common urls, data urls, blobs, and unknowns", () => {
  assert.equal(getImageExtension("https://cdn.example.com/image.png?width=1024"), "png");
  assert.equal(getImageExtension("data:image/jpeg;base64,abc"), "jpg");
  assert.equal(getImageExtension("blob:https://chatgpt.com/abc"), "png");
  assert.equal(getImageExtension("https://cdn.example.com/no-extension"), "png");
});

test("buildDownloadFilename is stable, safe, and sortable", () => {
  const filename = buildDownloadFilename({
    url: "https://cdn.example.com/my poster.webp?sig=abc",
    index: 7,
    now: new Date("2026-05-09T04:05:06Z")
  });

  assert.equal(filename, "chatgpt-image-20260509-040506-007.webp");
});

test("uniqueUrls removes duplicate and blank image urls", () => {
  assert.deepEqual(
    uniqueUrls(["", "https://a.test/1.png", "https://a.test/1.png", "https://a.test/2.png"]),
    ["https://a.test/1.png", "https://a.test/2.png"]
  );
});

test("uniqueElements removes duplicate and empty element references", () => {
  const first = {};
  const second = {};

  assert.deepEqual(uniqueElements([first, null, first, undefined, second]), [first, second]);
});

test("isLikelyTargetImage filters tiny/sidebar images and keeps gallery-sized images", () => {
  assert.equal(
    isLikelyTargetImage({ width: 92, height: 92, naturalWidth: 512, naturalHeight: 512, inNavigation: false }),
    false
  );
  assert.equal(
    isLikelyTargetImage({ width: 240, height: 180, naturalWidth: 1024, naturalHeight: 768, inNavigation: true }),
    false
  );
  assert.equal(
    isLikelyTargetImage({ width: 260, height: 260, naturalWidth: 1024, naturalHeight: 1024, inNavigation: false }),
    true
  );
});
