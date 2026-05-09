const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");

assert.equal(manifest.manifest_version, 3, "manifest_version must be 3");
assert.equal(manifest.version, packageJson.version, "manifest and package versions must match");
assert(changelog.includes(`## ${manifest.version} - `), "CHANGELOG.md must contain an entry for the current version");
assert.equal(manifest.background.service_worker, "background.js", "background service worker is missing");
assert(manifest.permissions.includes("downloads"), "downloads permission is required");
assert(!manifest.permissions.includes("tabs"), "tabs permission is not required");
assert(!manifest.host_permissions?.includes("<all_urls>"), "host permissions must stay scoped");
assert.equal(manifest.host_permissions, undefined, "host permissions should stay absent unless a runtime feature requires them");
assert.deepEqual(manifest.content_scripts?.[0]?.matches, ["https://chatgpt.com/*"], "content script must stay scoped to chatgpt.com");

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

for (const [size, file] of Object.entries(manifest.icons)) {
  const dimensions = readPngDimensions(path.join(root, file));
  assert.equal(dimensions.width, Number(size), `${file} width should be ${size}`);
  assert.equal(dimensions.height, Number(size), `${file} height should be ${size}`);
}

function readPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", `${filePath} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

console.log("Extension manifest validation passed.");
