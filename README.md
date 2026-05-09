# ChatGPT Images Quick Download

<p align="center">
  <img src="docs/logo.png" alt="ChatGPT Images Quick Download logo" width="140">
</p>

Small unpacked Chrome extension for `https://chatgpt.com/images`.

It adds a tiny transparent download icon on each gallery-sized image tile. Hover an image, click the icon, and the extension automatically uses ChatGPT's native full-size Save flow so you do not have to open each image and click inside it by hand.

## Why

ChatGPT Images shows many generated images in a gallery, but saving full-size files normally takes extra clicks per image. This extension adds the missing one-click affordance while staying out of the way of ChatGPT's native hover controls.

## UX

- Per-image floating download button, top-right of each target image.
- Does not overlap ChatGPT's native bottom hover controls such as `Edit` and share/open.
- Transparent by default, stronger on hover/focus, so the gallery stays clean.
- Uses ChatGPT's native fullscreen `Save` button when available, which downloads the full-size PNG into Chrome's normal Downloads location.
- Works with infinite scroll by rescanning new images automatically.
- Uses the best `srcset` candidate when the page exposes multiple image sizes.
- Popup includes `Download visible` and `Rescan` as backup controls.

## Install

1. Clone or download this repository.

```bash
git clone https://github.com/vecyang1/chatgpt-images-quick-download.git
```

2. Open `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the cloned `chatgpt-images-quick-download` folder.
6. Open `https://chatgpt.com/images`.
7. Hover an image and click the small download icon.

## Privacy

- No analytics.
- No remote server.
- No page data collection.
- Runs only on `chatgpt.com` and uses Chrome's downloads API only to save images.

## Files

```text
manifest.json          Chrome MV3 config
background.js          Uses chrome.downloads to save files
content.js             Adds image overlay buttons on ChatGPT Images
content.css            Transparent floating button and toast UI
popup.html/css/js      Small status and visible-download popup
icons/                 Generated extension logo and Chrome icon sizes
src/imageTargets.js    Tested URL, filename, and filtering helpers
test/                  Node tests
scripts/validate-extension.js
scripts/visual-smoke.js
docs/overlay-visual-smoke.png
```

## Verify

```bash
npm test
npm run validate
npm run visual-smoke
```

## Notes

- The extension is scoped to `chatgpt.com` plus OpenAI image CDN host patterns, not all websites.
- Direct URL fallback downloads are saved under `Downloads/ChatGPT Images/`; the primary native-save path keeps ChatGPT's normal filename and destination.
- Blob/data image URLs use an in-page fallback download because Chrome's background download API cannot always access page-owned blob URLs.
- If ChatGPT changes the gallery markup, click the extension popup's `Rescan`; if the image still has a normal `<img>` element and is gallery-sized, it should be detected.
