const statusEl = document.querySelector("#status");
const rescanButton = document.querySelector("#rescan");
const downloadVisibleButton = document.querySelector("#downloadVisible");

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
  const onImagesPage = Boolean(status?.isImagesPage);
  downloadVisibleButton.disabled = !onImagesPage || !status.visibleCount;
  rescanButton.disabled = !onImagesPage;

  if (!onImagesPage) {
    statusEl.textContent = "Open https://chatgpt.com/images first.";
    return;
  }

  statusEl.textContent = `${status.decoratedCount} images ready, ${status.visibleCount} visible.`;
}

async function refresh() {
  try {
    renderStatus(await sendToActiveTab({ type: "CGQID_GET_STATUS" }));
  } catch {
    renderStatus({ isImagesPage: false });
  }
}

rescanButton.addEventListener("click", async () => {
  rescanButton.disabled = true;
  try {
    renderStatus(await sendToActiveTab({ type: "CGQID_RESCAN" }));
  } finally {
    rescanButton.disabled = false;
  }
});

downloadVisibleButton.addEventListener("click", async () => {
  downloadVisibleButton.disabled = true;
  statusEl.textContent = "Starting visible downloads...";
  try {
    const result = await sendToActiveTab({ type: "CGQID_DOWNLOAD_VISIBLE" });
    statusEl.textContent = result?.downloaded ? `Started ${result.downloaded} downloads.` : "No visible images found.";
  } finally {
    setTimeout(refresh, 500);
  }
});

refresh();
