# Agent Handoff Notes

## Why The 0.4.x Release Felt Stronger

The release felt better because it treated the extension like a small production product instead of a loose unpacked script.

- It fixed real failure modes from review before polishing the public surface.
- It proved behavior with layered checks: unit tests, manifest validation, visual smoke, synthetic ChatGPT content E2E, local package creation, GitHub CI, and GitHub Release assets.
- It kept security explicit: no broad host permissions, URL allowlisting in both content/background paths, safe filenames, and MIME checks after download completion.
- It separated active-profile truth from source truth. The user's Chrome profile can keep an older unpacked content script until `chrome://extensions` reloads the extension, so repo/source verification and active-profile verification must be reported separately.
- It made the community path concrete: release zip, checksum, install instructions, issue template, PR template, contributor notes, repo topics, and release notes.

## Future Release Loop

Use this loop for meaningful changes:

1. Define the target behavior in one sentence and the failure modes that would embarrass the project in public.
2. Ask for or run a focused review pass on reliability, security/privacy, UX, and release packaging.
3. Fix the highest-risk issues before doing cosmetic or community polish.
4. Add or update tests at the right layer:
   - pure helpers: `node --test`
   - manifest/package rules: `npm run validate` and package tests
   - overlay layout: `npm run visual-smoke`
   - injected content behavior: `npm run e2e:extension`
5. Keep the active Chrome profile honest:
   - real ChatGPT profile checks are valuable for user-session proof
   - if the loaded unpacked extension is stale, do not treat that as source failure
   - ask the user to reload the unpacked extension in `chrome://extensions` before retesting that profile
6. Package before release, not after release.
7. Push `main`, watch CI, tag only when `main` is coherent.
8. After tagging, watch the release workflow and confirm the zip plus checksum are attached.
9. Update release notes with install steps and the highest-value safety/UX changes.
10. Leave a short handoff note if a lesson will matter to future agents.

## What Not To Change Automatically

- Do not bump `CHANGELOG.md` or the extension version for docs-only operational notes unless the docs are part of a public release promise.
- Do not add code just to encode a lesson when a checklist or runbook is clearer.
- Do not broaden permissions to make tests easier.
- Do not bypass browser automation policy to operate `chrome://extensions`; ask for manual reload when needed.

## Verification Baseline

Run the complete local gate before claiming a release-ready change:

```bash
npm run check
npm audit --audit-level=moderate
node --check background.js content.js popup.js src/imageTargets.js scripts/*.js
git diff --check
```

`npm run check` covers unit tests, manifest validation, visual smoke, synthetic ChatGPT content E2E, and deterministic zip packaging.

For docs-only changes, `git diff --check` plus a targeted read-through is enough unless the docs reference commands or version state that may have drifted.

## Chrome Reload Caveat

When this project is loaded as an unpacked Chrome extension, Chrome can keep an older content script active until the extension is reloaded in `chrome://extensions`. Reloading a ChatGPT tab alone may not prove the newest local source is active.

For current-source proof, check for the `data-cgqid-bound="true"` marker on `.cgqid-button` after injection. Older builds can show a button without that marker.

The Codex Chrome automation policy blocks operating `chrome://extensions`, so do not bypass that restriction. If the active user profile still has an old script, verify the repo with `npm run check`, then ask the user to reload the unpacked extension manually before live-profile retesting.

## Safety Invariants

- Keep `manifest.json` free of broad `host_permissions`.
- Keep background downloads restricted to allowlisted ChatGPT/OpenAI image surfaces and generated safe filenames.
- Treat present non-image MIME types, especially `text/html`, as download failures even if the filename extension looks like an image.
- Scope native `Save` and `Close` clicks to the fullscreen/dialog viewer root.
