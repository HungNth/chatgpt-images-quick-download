chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "CGQID_DOWNLOAD") return false;

  const { url, filename } = message;
  if (!url || !filename) {
    sendResponse({ ok: false, error: "Missing image URL or filename." });
    return false;
  }

  downloadAndWait(url, filename).then(sendResponse);

  return true;
});

async function downloadAndWait(url, filename) {
  const downloadId = await new Promise((resolve) => {
    chrome.downloads.download(
      {
        url,
        filename: `ChatGPT Images/${filename}`,
        conflictAction: "uniquify",
        saveAs: false
      },
      (id) => resolve({ id, error: chrome.runtime.lastError?.message || "" })
    );
  });

  if (downloadId.error || !downloadId.id) {
    return { ok: false, error: downloadId.error || "Chrome did not create a download." };
  }

  return waitForDownload(downloadId.id);
}

function waitForDownload(downloadId) {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => finish({ ok: true, downloadId, pending: true }), 60000);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve(result);
    }

    function onChanged(delta) {
      if (delta.id !== downloadId) return;

      if (delta.state?.current === "complete") {
        chrome.downloads.search({ id: downloadId }, ([download] = []) => {
          if (!isImageDownload(download)) {
            removeDownload(downloadId, () => {
              finish({
                ok: false,
                downloadId,
                error: "Downloaded file was not an image.",
                mime: download?.mime || ""
              });
            });
            return;
          }

          finish({ ok: true, downloadId, filename: download?.filename || "" });
        });
      } else if (delta.state?.current === "interrupted") {
        chrome.downloads.search({ id: downloadId }, ([download] = []) => {
          finish({
            ok: false,
            downloadId,
            error: download?.error || download?.interruptReason || "Download interrupted."
          });
        });
      }
    }

    chrome.downloads.onChanged.addListener(onChanged);
  });
}

function isImageDownload(download) {
  const mime = String(download?.mime || "").toLowerCase();
  const filename = String(download?.filename || download?.url || "").toLowerCase();

  if (mime.startsWith("image/")) return true;
  return /\.(?:png|jpe?g|webp|gif|avif)(?:[?#].*)?$/.test(filename);
}

function removeDownload(downloadId, callback) {
  let pending = 2;

  function done() {
    pending -= 1;
    if (pending <= 0) callback();
  }

  chrome.downloads.removeFile(downloadId, done);
  chrome.downloads.erase({ id: downloadId }, done);
}
