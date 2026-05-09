const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

assert.equal(manifest.manifest_version, 3, "manifest_version must be 3");
assert.equal(manifest.background.service_worker, "background.js", "background service worker is missing");
assert(manifest.permissions.includes("downloads"), "downloads permission is required");
assert(!manifest.host_permissions.includes("<all_urls>"), "host permissions must stay scoped");

const requiredFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  "popup.css",
  "popup.js",
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])]),
  ...Object.values(manifest.icons)
];

for (const file of new Set(requiredFiles)) {
  assert(fs.existsSync(path.join(root, file)), `${file} is referenced by manifest but missing`);
}

console.log("Extension manifest validation passed.");
