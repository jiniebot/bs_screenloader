export const DEFAULT_DURATION_DAYS = 7;

// Returns a "YYYY-MM-DD" string `days` days after the given "YYYY-MM-DD" string.
export const addDaysToDateString = (dateValue, days) => {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const combineDateTime = (dateValue, timeValue) => {
  if (!dateValue) return "";
  const time = timeValue || "00:00";
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  // Build the Date from local components (browser's timezone) so the
  // resulting ISO string is an unambiguous UTC instant, regardless of
  // what timezone the server happens to run in.
  const local = new Date(year, month - 1, day, hour, minute, 0, 0);
  return local.toISOString();
};

export const splitDateTime = (value) => {
  if (!value) return { date: "", time: "00:00" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "00:00" };
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
};

export const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const GOLDEN_ANGLE = 137.508;

// Light/faded fill for calendar event backgrounds. Spacing hues by the
// golden angle guarantees any two distinct indices land far apart on the
// color wheel — unlike hashing an id, which can occasionally put two
// unrelated events right next to each other by chance.
export const colorForIndex = (index) => `hsl(${(index * GOLDEN_ANGLE) % 360} 55% 88%)`;
