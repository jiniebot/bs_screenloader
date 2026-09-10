import { apiFetch } from "./api.js";
import { initAuth, setAuthState, setUserBadge, checkBootstrap } from "./auth.js";
import { loadGroups } from "./groups.js";
import { loadScreens } from "./screens.js";
import { loadLinks } from "./links.js";
import { loadSchedules } from "./schedules.js";
import { loadHistory } from "./history.js";
import { loadCalendar } from "./calendar.js";
import { loadTimeSlots } from "./timeslots.js";
import "./directUpload.js";
import "./users.js";

const adminPanel = document.getElementById("adminPanel");

const initializeApp = async () => {
  try {
    const data = await apiFetch("/api/auth/me");
    const user = data.user;
    setUserBadge(user);
    adminPanel.hidden = user.role !== "admin";
    setAuthState(true);
    if (user.role === "admin") {
      try {
        await loadGroups();
      } catch (err) {
        console.error("[app] loadGroups failed", err);
      }
    }
    try {
      await loadScreens();
    } catch (err) {
      console.error("[app] loadScreens failed", err);
    }
    try {
      await loadLinks();
    } catch (err) {
      console.error("[app] loadLinks failed", err);
    }
    try {
      await loadSchedules();
    } catch (err) {
      console.error("[app] loadSchedules failed", err);
    }
    try {
      await loadHistory();
    } catch (err) {
      console.error("[app] loadHistory failed", err);
    }
    try {
      await loadCalendar();
    } catch (err) {
      console.error("[app] loadCalendar failed", err);
    }
    try {
      await loadTimeSlots();
    } catch (err) {
      console.error("[app] loadTimeSlots failed", err);
    }
  } catch {
    setAuthState(false);
  }
};

initAuth({ onAuthSuccess: initializeApp });
initializeApp();
checkBootstrap();
