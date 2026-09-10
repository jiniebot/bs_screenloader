import { apiFetch } from "./api.js";
import { combineDateTime, formatDateTime } from "./utils.js";

const linkForm = document.getElementById("linkForm");
const linkStatus = document.getElementById("linkStatus");
const linksList = document.getElementById("linksList");

export const loadLinks = async () => {
  const data = await apiFetch("/api/links");
  linksList.innerHTML = "";
  (data.links || []).forEach((link) => {
    const row = document.createElement("div");
    row.className = "link-row";
    const url = `${window.location.origin}/upload.html?token=${link.token}`;
    row.innerHTML = `
      <div>
        <strong>${link.screen}</strong>
        <div class="muted">${link.name || "Untitled"}</div>
        <div class="muted">Start: ${formatDateTime(link.startDate)}</div>
      </div>
      <div class="link-actions">
        <button class="ghost" data-copy="${url}">Copy link</button>
        <span class="pill ${link.status === "used" ? "status-used" : ""}">${link.status}</span>
      </div>
    `;
    linksList.appendChild(row);
  });

  linksList.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy link"), 1200);
    });
  });
};

linkForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  linkStatus.textContent = "Creating link...";
  try {
    const startDate = combineDateTime(linkForm.startDate.value, linkForm.startTime.value);
    const endDate = linkForm.endDate.value
      ? combineDateTime(linkForm.endDate.value, linkForm.endTime.value)
      : undefined;
    const body = {
      screenId: linkForm.screenId.value,
      name: linkForm.name.value,
      description: linkForm.description.value,
      startDate,
      endDate,
      expiresAt: linkForm.expiresAt.value || undefined,
      durationMinSec: linkForm.durationMinSec.value || undefined,
      durationMaxSec: linkForm.durationMaxSec.value || undefined,
    };
    const data = await apiFetch("/api/links", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const url = `${window.location.origin}/upload.html?token=${data.token}`;
    linkStatus.textContent = `Link created: ${url}`;
    linkForm.reset();
    await loadLinks();
  } catch (err) {
    linkStatus.textContent = err.message;
  }
});
