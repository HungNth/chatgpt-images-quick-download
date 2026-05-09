const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const PACKAGE_ENTRIES = [
  "manifest.json",
  "background.js",
  "content.js",
  "content.css",
  "popup.html",
  "popup.css",
  "popup.js",
  "src/imageTargets.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "icons/icon1024.png",
  "icons/icon.svg",
  "docs/logo.png",
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "CHANGELOG.md"
];

function getPackageBasename(version) {
  return `chatgpt-images-quick-download-v${version}`;
}

function assertPackageEntriesExist(cwd = root) {
  for (const entry of PACKAGE_ENTRIES) {
    assert(fs.existsSync(path.join(cwd, entry)), `${entry} is missing from the extension package`);
  }
}

function createPackage({ cwd = root } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "manifest.json"), "utf8"));
  const basename = getPackageBasename(manifest.version);
  const distDir = path.join(cwd, "dist");
  const zipPath = path.join(distDir, `${basename}.zip`);
  const checksumPath = `${zipPath}.sha256`;

  assertPackageEntriesExist(cwd);
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const zip = spawnSync("zip", ["-qr", zipPath, ...PACKAGE_ENTRIES], {
    cwd,
    encoding: "utf8"
  });

  if (zip.error?.code === "ENOENT") {
    throw new Error("The `zip` command was not found. Install zip or run this on macOS/Linux with zip available.");
  }

  if (zip.status !== 0) {
    throw new Error(zip.stderr || "zip failed to create the extension package.");
  }

  const digest = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
  fs.writeFileSync(checksumPath, `${digest}  ${path.basename(zipPath)}\n`);

  return { zipPath, checksumPath, digest };
}

if (require.main === module) {
  const result = createPackage();
  console.log(`Created ${result.zipPath}`);
  console.log(`SHA-256 ${result.digest}`);
}

module.exports = {
  PACKAGE_ENTRIES,
  assertPackageEntriesExist,
  createPackage,
  getPackageBasename
};
