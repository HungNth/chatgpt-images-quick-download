const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBackgroundWithChrome(chrome) {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "background.js"), "utf8");
  const helperSource = fs.readFileSync(path.resolve(__dirname, "..", "src", "imageTargets.js"), "utf8");
  const context = {
    chrome,
    clearTimeout,
    console,
    globalThis: {},
    importScripts(scriptPath) {
      assert.equal(scriptPath, "src/imageTargets.js");
      vm.runInContext(helperSource, context, { filename: scriptPath });
    },
    setTimeout,
    URL
  };

  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "background.js" });
  return context;
}

test("downloadAndWait rejects completed non-image downloads and removes the stray file", async () => {
  let onChanged;
  let removedFile = false;
  let erased = false;

  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener() {}
      }
    },
    downloads: {
      download(_options, callback) {
        callback(42);
        setTimeout(() => {
          onChanged({ id: 42, state: { current: "complete" } });
        }, 0);
      },
      erase(query, callback) {
        erased = query.id === 42;
        callback?.();
      },
      onChanged: {
        addListener(listener) {
          onChanged = listener;
        },
        removeListener() {}
      },
      removeFile(downloadId, callback) {
        removedFile = downloadId === 42;
        callback?.();
      },
      search(query, callback) {
        assert.equal(query.id, 42);
        callback([
          {
            id: 42,
            filename: "/Users/example/Downloads/svg.html",
            mime: "text/html",
            state: "complete"
          }
        ]);
      }
    }
  };

  const context = loadBackgroundWithChrome(chrome);
  const result = await context.downloadAndWait(
    "https://chatgpt.com/backend-api/estuary/content?id=file_123&sig=trusted",
    "chatgpt-image-20260509-120000-001.png"
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /not an image/i);
  assert.equal(removedFile, true);
  assert.equal(erased, true);
});

test("isImageDownload rejects html error pages even when the filename looks like a PNG", () => {
  const chrome = {
    runtime: {
      onMessage: {
        addListener() {}
      }
    },
    downloads: {
      onChanged: {
        addListener() {},
        removeListener() {}
      }
    }
  };

  const context = loadBackgroundWithChrome(chrome);

  assert.equal(
    context.isImageDownload({
      filename: "/Users/example/Downloads/chatgpt-image.png",
      mime: "text/html"
    }),
    false
  );
  assert.equal(
    context.isImageDownload({
      filename: "/Users/example/Downloads/chatgpt-image.png",
      mime: "application/octet-stream"
    }),
    true
  );
});

test("downloadAndWait rejects untrusted urls before Chrome starts a download", async () => {
  let downloadCalled = false;
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener() {}
      }
    },
    downloads: {
      download() {
        downloadCalled = true;
      },
      onChanged: {
        addListener() {},
        removeListener() {}
      }
    }
  };

  const context = loadBackgroundWithChrome(chrome);
  const result = await context.downloadAndWait(
    "https://tracking.example.com/image.png",
    "chatgpt-image-20260509-120000-001.png"
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /not allowed/i);
  assert.equal(downloadCalled, false);
});
