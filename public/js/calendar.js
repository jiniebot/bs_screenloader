import { apiFetch } from "./api.js";
import { state } from "./state.js";
import { getMonthRange, getScreenColor } from "./utils.js";
import { openScheduleModal } from "./schedules.js";

const calScreenFilter = document.getElementById("calScreenFilter");
const daypilotRoot = document.getElementById("daypilotCalendar");

// Rebuilds the calendar's rendered events purely from whatever is already
// in state.occurrences/state.schedules — no network request. Used both
// after a real fetch (loadCalendar) and after a local-only edit that
// hasn't (or won't) be persisted yet, e.g. the timeslot "preview" edit in
// schedules.js, so the calendar reflects it immediately.
export const renderCalendarEvents = () => {
  if (!daypilotRoot || !window.DayPilot || !state.daypilotCalendar) return;

  const range = getMonthRange(new Date());
  const filterScreenId = calScreenFilter.value || "all";
  const timeSlotEvents = state.occurrences
    .filter((occ) => filterScreenId === "all" || occ.screenId === filterScreenId)
    .map((occ) => ({
      id: occ.id,
      text: `${occ.name}${occ.assigned ? " · assigned" : ""}`,
      start: occ.start,
      end: occ.end,
      backColor: getScreenColor(occ.screenId),
      fontColor: "#0b0d12",
      data: occ,
    }));

  // One-off schedules from upload links / direct upload — separate from
  // recurring TimeSlots, but should still show up on the calendar.
  const scheduleEvents = (state.schedules || [])
    .filter((s) => ["scheduled", "queued", "processing", "completed"].includes(s.status))
    .filter((s) => filterScreenId === "all" || s.screenId === filterScreenId)
    .filter((s) => {
      const start = new Date(s.startDate);
      const end = s.endDate ? new Date(s.endDate) : start;
      return start <= range.end && end >= range.start;
    })
    .map((s) => ({
      id: `schedule-${s.id}`,
      text: `${s.name || "Untitled"} · ${s.status}`,
      start: s.startDate,
      end: s.endDate || s.startDate,
      backColor: getScreenColor(s.screenId),
      fontColor: "#0b0d12",
      data: { ...s, __eventType: "schedule" },
    }));

  state.daypilotCalendar.events.list = [...timeSlotEvents, ...scheduleEvents];
  state.daypilotCalendar.update();
};

export const loadCalendar = async () => {
  const range = getMonthRange(new Date());
  try {
    const occData = await apiFetch(
      `/api/timeslots/occurrences?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`,
    );
    state.occurrences = occData.occurrences || [];
  } catch {
    state.occurrences = [];
  }
  const previousSelection = calScreenFilter.value || "all";
  const screenOptions = [
    { id: "all", name: "All screens" },
    ...state.screens.map((s) => ({ id: s.id, name: s.name })),
  ];
  calScreenFilter.innerHTML = "";
  screenOptions.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.id;
    option.textContent = opt.name;
    calScreenFilter.appendChild(option);
  });
  if (screenOptions.some((opt) => opt.id === previousSelection)) {
    calScreenFilter.value = previousSelection;
  }
  if (!daypilotRoot) return;
  if (!window.DayPilot) return;

  if (!state.daypilotCalendar) {
    state.daypilotCalendar = new window.DayPilot.Month(daypilotRoot, {
      theme: "month_default",
      startDate: window.DayPilot.Date.today(),
      eventMoveHandling: "Disabled",
      eventResizeHandling: "Disabled",
      eventDeleteHandling: "Disabled",
      onEventClick: (args) => {
        const data = args?.e?.data;
        if (data) {
          openScheduleModal(data, data.__eventType === "schedule" ? "schedule" : "timeslot");
        }
      },
    });
    state.daypilotCalendar.init();
  }

  renderCalendarEvents();
};

calScreenFilter?.addEventListener("change", () => {
  loadCalendar();
});
