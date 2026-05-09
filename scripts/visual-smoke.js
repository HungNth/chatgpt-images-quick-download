const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function findChromeExecutable({
  env = process.env,
  platform = process.platform,
  existsSync = fs.existsSync
} = {}) {
  const candidates = [
    env.CHROME_BIN,
    env.GOOGLE_CHROME_SHIM,
    platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "",
    platform === "linux" ? "/usr/bin/google-chrome" : "",
    platform === "linux" ? "/usr/bin/google-chrome-stable" : "",
    platform === "linux" ? "/usr/bin/chromium" : "",
    platform === "linux" ? "/usr/bin/chromium-browser" : ""
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function buildVisualSmokeHtml(css) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      ${css}
      body {
        align-items: center;
        background: #111;
        display: flex;
        height: 100vh;
        justify-content: center;
        margin: 0;
      }
      .tile {
        border-radius: 4px;
        height: 480px;
        overflow: hidden;
        width: 480px;
      }
      .photo {
        background:
          radial-gradient(circle at 48% 26%, #ffd8d8 0 7%, transparent 8%),
          radial-gradient(circle at 46% 40%, #f2c0a9 0 13%, transparent 14%),
          linear-gradient(135deg, #83a98d, #f4f0e7 45%, #28323a);
        height: 100%;
        width: 100%;
      }
      .native-edit,
      .native-share {
        align-items: center;
        background: rgba(104, 100, 108, 0.72);
        border-radius: 999px;
        bottom: 30px;
        color: #fff;
        display: flex;
        font: 700 26px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 72px;
        justify-content: center;
        position: absolute;
      }
      .native-edit {
        left: 28px;
        width: 98px;
      }
      .native-share {
        right: 28px;
        width: 72px;
      }
      .native-share svg {
        height: 34px;
        width: 34px;
      }
      #result {
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="tile cgqid-host" id="tile">
      <div class="photo"></div>
      <button class="cgqid-button" id="download" type="button" aria-label="Download this image">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 19h14" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="native-edit" id="edit">Edit</div>
      <div class="native-share" id="share">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 15V4m0 0 4 4m-4-4L8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    <pre id="result"></pre>
    <script>
      const download = document.querySelector("#download").getBoundingClientRect();
      const edit = document.querySelector("#edit").getBoundingClientRect();
      const share = document.querySelector("#share").getBoundingClientRect();
      const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const ok = !overlaps(download, edit) && !overlaps(download, share) && download.top < edit.top && download.top < share.top;
      document.querySelector("#result").textContent = JSON.stringify({
        ok,
        download: { top: download.top, right: download.right, bottom: download.bottom, left: download.left },
        edit: { top: edit.top, right: edit.right, bottom: edit.bottom, left: edit.left },
        share: { top: share.top, right: share.right, bottom: share.bottom, left: share.left }
      });
    </script>
  </body>
</html>`;
}

function runVisualSmoke({ updateScreenshot = false } = {}) {
  const chrome = findChromeExecutable();
  assert(chrome, "Google Chrome or Chromium binary was not found. Set CHROME_BIN to run the visual smoke test.");

  const css = fs.readFileSync(path.join(root, "content.css"), "utf8");
  const outDir = updateScreenshot ? path.join(root, "docs") : fs.mkdtempSync(path.join(os.tmpdir(), "cgqid-smoke-"));
  const htmlPath = path.join(os.tmpdir(), "chatgpt-images-quick-download-visual-smoke.html");
  const screenshotPath = updateScreenshot
    ? path.join(outDir, "overlay-visual-smoke.png")
    : path.join(outDir, "overlay-visual-smoke.png");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(htmlPath, buildVisualSmokeHtml(css));

  const fileUrl = `file://${htmlPath}`;
  const dump = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--dump-dom", fileUrl], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const resultText = dump.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];
  assert(resultText, "Visual smoke page did not report layout metrics.");
  const result = JSON.parse(resultText.replaceAll("&quot;", "\""));
  assert.equal(result.ok, true, `Download button overlaps native controls: ${JSON.stringify(result)}`);

  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--window-size=720,620",
      `--screenshot=${screenshotPath}`,
      fileUrl
    ],
    { stdio: "ignore" }
  );

  return screenshotPath;
}

if (require.main === module) {
  const screenshotPath = runVisualSmoke({ updateScreenshot: process.argv.includes("--update-screenshot") });
  console.log(`Visual smoke passed. Screenshot: ${screenshotPath}`);
}

module.exports = {
  buildVisualSmokeHtml,
  findChromeExecutable,
  runVisualSmoke
};
