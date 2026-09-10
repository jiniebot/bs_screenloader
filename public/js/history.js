import { apiFetch } from "./api.js";
import { formatDateTime } from "./utils.js";

const historyList = document.getElementById("historyList");

export const loadHistory = async () => {
  if (!historyList) return;
  const data = await apiFetch("/api/library");
  const assets = data.assets || [];
  historyList.innerHTML = "";
  if (!assets.length) {
    historyList.innerHTML = `<div class="list-item muted">No library items yet.</div>`;
    return;
  }
  assets.forEach((asset) => {
    const lastPlayed = asset.playHistory?.[0];
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <strong>${asset.originalName}</strong>
      <div class="muted">Duration: ${asset.durationSec || "—"}s</div>
      <div class="muted">Last played: ${formatDateTime(lastPlayed)}</div>
    `;
    historyList.appendChild(row);
  });
};
