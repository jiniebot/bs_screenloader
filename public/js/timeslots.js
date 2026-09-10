import { apiFetch } from "./api.js";
import { loadCalendar } from "./calendar.js";

const timeSlotForm = document.getElementById("timeSlotForm");
const slotStatus = document.getElementById("slotStatus");
const slotList = document.getElementById("slotList");

export const loadTimeSlots = async () => {
  if (!slotList) return;
  const data = await apiFetch("/api/timeslots");
  const slots = data.timeslots || [];
  slotList.innerHTML = "";
  if (!slots.length) {
    slotList.innerHTML = `<div class="list-item muted">No slots yet.</div>`;
    return;
  }
  slots.forEach((slot) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <strong>${slot.name}</strong>
      <div class="muted">${slot.screenName}</div>
      <div class="muted">${slot.startTime} - ${slot.endTime}</div>
    `;
    slotList.appendChild(row);
  });
};

timeSlotForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  slotStatus.textContent = "Creating slot...";
  try {
    const byWeekday = Array.from(
      timeSlotForm.querySelectorAll('input[name="byWeekday"]:checked'),
    ).map((el) => el.value);
    const exceptions = timeSlotForm.exceptions.value
      ? timeSlotForm.exceptions.value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const body = {
      screenId: timeSlotForm.screenId.value,
      name: timeSlotForm.name.value,
      startDate: timeSlotForm.startDate.value,
      endDate: timeSlotForm.endDate.value || undefined,
      startTime: timeSlotForm.startTime.value,
      endTime: timeSlotForm.endTime.value,
      frequency: timeSlotForm.frequency.value,
      interval: timeSlotForm.interval.value,
      byWeekday,
      until: timeSlotForm.until.value || undefined,
      exceptions,
    };
    await apiFetch("/api/timeslots", { method: "POST", body: JSON.stringify(body) });
    slotStatus.textContent = "Slot created.";
    timeSlotForm.reset();
    await loadTimeSlots();
    await loadCalendar();
  } catch (err) {
    slotStatus.textContent = err.message;
  }
});
