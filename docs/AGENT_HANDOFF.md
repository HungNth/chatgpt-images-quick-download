# Agent Handoff Notes

## Verification Baseline

Run the complete local gate before claiming a release-ready change:

```bash
npm run check
npm audit --audit-level=moderate
node --check background.js content.js popup.js src/imageTargets.js scripts/*.js
git diff --check
```

`npm run check` covers unit tests, manifest validation, visual smoke, synthetic ChatGPT content E2E, and deterministic zip packaging.

## Chrome Reload Caveat

When this project is loaded as an unpacked Chrome extension, Chrome can keep an older content script active until the extension is reloaded in `chrome://extensions`. Reloading a ChatGPT tab alone may not prove the newest local source is active.

For current-source proof, check for the `data-cgqid-bound="true"` marker on `.cgqid-button` after injection. Older builds can show a button without that marker.

The Codex Chrome automation policy blocks operating `chrome://extensions`, so do not bypass that restriction. If the active user profile still has an old script, verify the repo with `npm run check`, then ask the user to reload the unpacked extension manually before live-profile retesting.

## Safety Invariants

- Keep `manifest.json` free of broad `host_permissions`.
- Keep background downloads restricted to allowlisted ChatGPT/OpenAI image surfaces and generated safe filenames.
- Treat present non-image MIME types, especially `text/html`, as download failures even if the filename extension looks like an image.
- Scope native `Save` and `Close` clicks to the fullscreen/dialog viewer root.
