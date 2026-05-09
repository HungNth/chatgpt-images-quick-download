# Contributing

Thanks for helping improve ChatGPT Images Quick Download.

## Local Checks

Run the same checks as CI before opening a pull request:

```bash
npm test
npm run validate
npm run visual-smoke
npm run e2e:extension
npm run package
```

## Design Rules

- Keep the extension scoped to `chatgpt.com`.
- Do not add analytics, tracking, or remote servers.
- Prefer ChatGPT's native full-size Save flow before direct URL fallbacks.
- Keep the overlay small and out of ChatGPT's native hover controls.
- Add or update tests for URL ranking, permissions, packaging, and download safety changes.

## Release

Update `manifest.json`, `package.json`, and `CHANGELOG.md` together. Tags named `vX.Y.Z` create a release zip and checksum through GitHub Actions.
