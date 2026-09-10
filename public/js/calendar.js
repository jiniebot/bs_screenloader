import { apiFetch } from "./api.js";
import { state } from "./state.js";
import { getMonthRange, getScreenColor } from "./utils.js";
import { openScheduleModal } from "./schedules.js";

const calScreenFilter = document.getElementById("calScreenFilter");
const daypilotRoot = document.getElementById("daypilotCalendar");

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
        if (args?.e?.data) {
          openScheduleModal(args.e.data, "timeslot");
        }
      },
    });
    state.daypilotCalendar.init();
  }

  const filterScreenId = calScreenFilter.value || "all";
  const events = state.occurrences
    .filter((occ) => filterScreenId === "all" || occ.screenId === filterScreenId)
    .map((occ) => ({
      id: occ.id,
      text: `${occ.name}${occ.assigned ? " · assigned" : ""}`,
      start: occ.start,
      end: occ.end,
      backColor: getScreenColor(occ.screenId),
      barColor: getScreenColor(occ.screenId),
      fontColor: "#0b0d12",
      data: occ,
    }));

  state.daypilotCalendar.events.list = events;
  state.daypilotCalendar.update();
};

calScreenFilter?.addEventListener("change", () => {
  loadCalendar();
});
