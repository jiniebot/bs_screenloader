import { apiFetch } from "./api.js";
import { combineDateTime, formatDateTime, addDaysToDateString, DEFAULT_DURATION_DAYS } from "./utils.js";

const linkForm = document.getElementById("linkForm");
const linkStatus = document.getElementById("linkStatus");
const linksList = document.getElementById("linksList");

linkForm?.startDate?.addEventListener("change", () => {
  if (!linkForm.startDate.value || linkForm.endDate.value) return;
  linkForm.endDate.value = addDaysToDateString(linkForm.startDate.value, DEFAULT_DURATION_DAYS);
  linkForm.endTime.value = linkForm.startTime.value || "00:00";
});

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
        <div class="muted">End: ${link.endDate ? formatDateTime(link.endDate) : "Never"}</div>
      </div>
      <div class="link-actions">
        <button class="ghost" data-copy="${url}">Copy link</button>
        <span class="pill ${link.status === "used" ? "status-used" : ""}">${link.status}</span>
        <button class="ghost danger" data-delete="${link.id}">Delete</button>
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

  linksList.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Delete this upload link? This cannot be undone.")) return;
      btn.disabled = true;
      try {
        await apiFetch(`/api/links/${btn.dataset.delete}`, { method: "DELETE" });
        await loadLinks();
      } catch (err) {
        linkStatus.textContent = err.message;
        btn.disabled = false;
      }
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
