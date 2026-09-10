import { apiFetch } from "./api.js";
import { state } from "./state.js";
import { combineDateTime, splitDateTime, formatDateTime } from "./utils.js";
import { createDialog } from "./dialog.js";
import { loadCalendar } from "./calendar.js";
import { loadHistory } from "./history.js";

const scheduleRows = document.getElementById("scheduleRows");
const scheduleModalEl = document.getElementById("scheduleModal");
const scheduleForm = document.getElementById("scheduleForm");
const scheduleStatus = document.getElementById("scheduleStatus");
const scheduleDeleteBtn = document.getElementById("scheduleDeleteBtn");
const scheduleModalTitle = document.getElementById("scheduleModalTitle");
const scheduleLinkBtn = document.getElementById("scheduleLinkBtn");
const scheduleCopyBtn = document.getElementById("scheduleCopyBtn");

const dialog = scheduleModalEl ? createDialog(scheduleModalEl) : null;

export const loadSchedules = async () => {
  const data = await apiFetch("/api/schedules");
  state.schedules = data.schedules || [];
  scheduleRows.innerHTML = "";
  const schedules = state.schedules.filter((s) =>
    ["scheduled", "queued", "processing"].includes(s.status),
  );
  if (!schedules.length) {
    scheduleRows.innerHTML = `<div class="table-row"><span>No schedules yet.</span></div>`;
    return;
  }

  schedules.forEach((schedule) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const canEdit = schedule.status === "scheduled";
    row.innerHTML = `
      <span data-label="Screen">${schedule.screen}</span>
      <span data-label="Video">${schedule.name}</span>
      <span data-label="Start">${formatDateTime(schedule.startDate)}</span>
      <span data-label="End">${formatDateTime(schedule.endDate)}</span>
      <span data-label="Status">${schedule.status}</span>
      <span class="row-actions" data-label="Actions">
        ${canEdit ? `<button class="ghost" data-action="edit" data-id="${schedule.id}">Edit</button>` : ""}
        <button class="ghost" data-action="cancel" data-id="${schedule.id}">Deschedule</button>
      </span>
    `;
    scheduleRows.appendChild(row);
  });

  scheduleRows.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const schedule = state.schedules.find((s) => s.id === btn.dataset.id);
      if (schedule) openScheduleModal(schedule, "schedule");
    });
  });
  scheduleRows.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const schedule = state.schedules.find((s) => s.id === btn.dataset.id);
      if (schedule) await cancelSchedule(schedule.id);
    });
  });
};

export const cancelSchedule = async (id) => {
  try {
    await apiFetch(`/api/schedules/${id}`, { method: "DELETE" });
    await loadSchedules();
    await loadHistory();
    await loadCalendar();
  } catch (err) {
    console.error("[app] cancelSchedule failed", err);
  }
};

export const openScheduleModal = (schedule, mode = "schedule") => {
  if (!scheduleModalEl || !scheduleForm) return;
  state.scheduleModal.mode = mode;
  state.scheduleModal.sourceId = schedule.id;
  state.scheduleModal.occurrence = schedule;
  state.scheduleModal.lastGeneratedLink = "";
  const startValue = schedule.startDate || schedule.start;
  const endValue = schedule.endDate || schedule.end;
  const start = splitDateTime(startValue);
  const end = splitDateTime(endValue);
  scheduleForm.scheduleId.value = schedule.id;
  scheduleForm.startDate.value = start.date;
  scheduleForm.startTime.value = start.time;
  scheduleForm.endDate.value = end.date;
  scheduleForm.endTime.value = end.time;
  scheduleStatus.textContent = "";
  scheduleModalTitle.textContent =
    mode === "timeslot" ? "Time slot details" : "Update timing or cancel.";
  if (scheduleLinkBtn && scheduleCopyBtn) {
    const showLink = mode === "timeslot";
    scheduleLinkBtn.style.display = showLink ? "inline-flex" : "none";
    scheduleCopyBtn.style.display = showLink ? "inline-flex" : "none";
  }
  dialog?.open();
};

const closeScheduleModal = () => dialog?.close();

scheduleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  scheduleStatus.textContent = "Saving...";
  try {
    const startDate = combineDateTime(
      scheduleForm.startDate.value,
      scheduleForm.startTime.value,
    );
    const endDate = scheduleForm.endDate.value
      ? combineDateTime(scheduleForm.endDate.value, scheduleForm.endTime.value)
      : undefined;
    if (state.scheduleModal.mode === "timeslot") {
      state.scheduleModal.occurrence.start = new Date(startDate);
      state.scheduleModal.occurrence.end = endDate
        ? new Date(endDate)
        : new Date(startDate);
      scheduleStatus.textContent = "Updated. Use Create Upload Link.";
    } else {
      await apiFetch(`/api/schedules/${state.scheduleModal.sourceId}`, {
        method: "PATCH",
        body: JSON.stringify({ startDate, endDate }),
      });
      scheduleStatus.textContent = "Saved.";
      closeScheduleModal();
      await loadSchedules();
      await loadHistory();
      await loadCalendar();
    }
  } catch (err) {
    scheduleStatus.textContent = err.message;
  }
});

scheduleDeleteBtn?.addEventListener("click", async () => {
  if (!state.scheduleModal.sourceId) return;
  if (state.scheduleModal.mode === "timeslot") {
    const occStart = state.scheduleModal.occurrence?.start;
    if (occStart) {
      await apiFetch(
        `/api/timeslots/${state.scheduleModal.occurrence.timeSlotId}/occurrence?occurrenceStart=${encodeURIComponent(
          new Date(occStart).toISOString(),
        )}`,
        { method: "DELETE" },
      );
      await loadCalendar();
    }
    closeScheduleModal();
  } else {
    await cancelSchedule(state.scheduleModal.sourceId);
    closeScheduleModal();
  }
});

scheduleLinkBtn?.addEventListener("click", async () => {
  if (state.scheduleModal.mode !== "timeslot" || !state.scheduleModal.occurrence) return;
  scheduleStatus.textContent = "Creating link...";
  try {
    const startDate = combineDateTime(
      scheduleForm.startDate.value,
      scheduleForm.startTime.value,
    );
    const endDate = scheduleForm.endDate.value
      ? combineDateTime(scheduleForm.endDate.value, scheduleForm.endTime.value)
      : undefined;
    const data = await apiFetch(
      `/api/timeslots/${state.scheduleModal.occurrence.timeSlotId}/link`,
      {
        method: "POST",
        body: JSON.stringify({
          occurrenceStart: startDate,
          occurrenceEnd: endDate || startDate,
        }),
      },
    );
    state.scheduleModal.lastGeneratedLink = `${window.location.origin}/upload.html?token=${data.token}`;
    scheduleStatus.textContent = `Link ready.`;
  } catch (err) {
    scheduleStatus.textContent = err.message;
  }
});

scheduleCopyBtn?.addEventListener("click", async () => {
  if (!state.scheduleModal.lastGeneratedLink) {
    scheduleStatus.textContent = "Create a link first.";
    return;
  }
  await navigator.clipboard.writeText(state.scheduleModal.lastGeneratedLink);
  scheduleStatus.textContent = "Link copied.";
});

document.querySelectorAll('[data-close="schedule"]').forEach((btn) => {
  btn.addEventListener("click", closeScheduleModal);
});
