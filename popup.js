const statusEl = document.querySelector("#status");
const rescanButton = document.querySelector("#rescan");
const downloadVisibleButton = document.querySelector("#downloadVisible");
const formatOriginalButton = document.querySelector("#formatOriginal");
const formatJpgButton = document.querySelector("#formatJpg");

const FORMAT_KEY = "downloadFormat";
const FORMAT_ORIGINAL = "original";
const FORMAT_JPG = "jpg";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function renderStatus(status) {
  const onSupportedPage = Boolean(status?.isSupportedPage || status?.isImagesPage);
  downloadVisibleButton.disabled = !onSupportedPage || !status.visibleCount;
  rescanButton.disabled = !onSupportedPage;

  if (!onSupportedPage) {
    statusEl.textContent = "Open ChatGPT Images or a ChatGPT conversation first.";
    return;
  }

  statusEl.textContent = `${status.decoratedCount} images ready, ${status.visibleCount} visible.`;
}

function setActiveFormat(format) {
  const isJpg = format === FORMAT_JPG;
  formatOriginalButton.classList.toggle("active", !isJpg);
  formatOriginalButton.setAttribute("aria-checked", String(!isJpg));
  formatJpgButton.classList.toggle("active", isJpg);
  formatJpgButton.setAttribute("aria-checked", String(isJpg));
}

async function loadFormat() {
  const result = await chrome.storage.local.get(FORMAT_KEY);
  return result[FORMAT_KEY] === FORMAT_JPG ? FORMAT_JPG : FORMAT_ORIGINAL;
}

async function saveFormat(format) {
  await chrome.storage.local.set({ [FORMAT_KEY]: format });
}

async function refresh() {
  try {
    renderStatus(await sendToActiveTab({ type: "CGQID_GET_STATUS" }));
  } catch {
    renderStatus({ isSupportedPage: false });
  }
}

formatOriginalButton.addEventListener("click", async () => {
  setActiveFormat(FORMAT_ORIGINAL);
  await saveFormat(FORMAT_ORIGINAL);
});

formatJpgButton.addEventListener("click", async () => {
  setActiveFormat(FORMAT_JPG);
  await saveFormat(FORMAT_JPG);
});

rescanButton.addEventListener("click", async () => {
  rescanButton.disabled = true;
  try {
    renderStatus(await sendToActiveTab({ type: "CGQID_RESCAN" }));
  } catch {
    renderStatus({ isSupportedPage: false });
  }
});

downloadVisibleButton.addEventListener("click", async () => {
  downloadVisibleButton.disabled = true;
  statusEl.textContent = "Starting visible downloads...";
  try {
    const result = await sendToActiveTab({ type: "CGQID_DOWNLOAD_VISIBLE" });
    statusEl.textContent = result?.downloaded ? `Started ${result.downloaded} downloads.` : "No visible images found.";
  } catch {
    renderStatus({ isSupportedPage: false });
  } finally {
    setTimeout(refresh, 500);
  }
});

// Initialize
(async () => {
  const format = await loadFormat();
  setActiveFormat(format);
  refresh();
})();
