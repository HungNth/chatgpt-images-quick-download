# Changelog

## 0.3.0 - 2026-05-09

- Added hover download buttons for generated images inside normal ChatGPT conversation pages (`/c/...`), not only the Images gallery.
- Recognized ChatGPT's chat-thread `Open image in full view` control so one-click downloads can still use the native full-size Save flow.
- Kept one overlay per generated image host in chat threads and updated popup status text for both supported surfaces.

## 0.2.0 - 2026-05-09

- Added the generated public app logo and refreshed Chrome extension icon sizes.
- Prepared the project for public GitHub community use with MIT licensing and public-facing README copy.

## 0.1.4 - 2026-05-09

- Added a native ChatGPT fullscreen-save bridge so each overlay button downloads the full-size image instead of the rendered thumbnail.

## 0.1.3 - 2026-05-09

- Rejected SVG namespace and injected-control metadata URLs from download candidate ranking.
- Made the background worker reject completed non-image downloads so the content script can try the next image candidate.

## 0.1.2 - 2026-05-09

- Fixed bad candidate selection that could try to download ChatGPT backend JSON (`backend-api/e`) instead of an image.
- Added ChatGPT estuary thumbnail expansion so `#thumbnail` content URLs try the matching full-size content URL first.
- Added download completion monitoring so interrupted Chrome downloads can fall back to the next candidate.

## 0.1.1 - 2026-05-09

- Fixed thumbnail-only downloads by preferring full-size/original candidate URLs from the image tile before falling back to the rendered thumbnail.
- Added regression tests for encoded proxy URLs and nearby original image assets.

## 0.1.0 - 2026-05-09

- Added Manifest V3 Chrome extension for `chatgpt.com/images`.
- Added transparent one-click download icon on gallery-sized target images.
- Added popup controls for visible downloads and rescanning.
- Added tested image URL selection, filename generation, duplicate filtering, and manifest validation.
