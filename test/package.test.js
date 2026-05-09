const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const { PACKAGE_ENTRIES, getPackageBasename } = require("../scripts/package-extension.js");

test("extension package contains only runtime and community files", () => {
  assert(PACKAGE_ENTRIES.includes("manifest.json"));
  assert(PACKAGE_ENTRIES.includes("src/imageTargets.js"));
  assert(PACKAGE_ENTRIES.includes("README.md"));
  assert(PACKAGE_ENTRIES.includes("LICENSE"));
  assert(PACKAGE_ENTRIES.includes("CHANGELOG.md"));

  for (const blocked of ["test", "node_modules", ".git", "dist", "docs/overlay-visual-smoke.png"]) {
    assert.equal(PACKAGE_ENTRIES.some((entry) => entry === blocked || entry.startsWith(`${blocked}/`)), false);
  }

  for (const entry of PACKAGE_ENTRIES) {
    assert(fs.existsSync(path.join(root, entry)), `${entry} should exist`);
  }
});

test("package basename follows the manifest version", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(getPackageBasename(manifest.version), `chatgpt-images-quick-download-v${manifest.version}`);
});
