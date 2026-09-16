import { apiFetch } from "./api.js";
import { state } from "./state.js";
import { loadCalendar } from "./calendar.js";
import { createDialog } from "./dialog.js";

const screensGrid = document.getElementById("screensGrid");
const linkScreenSelect = document.getElementById("linkScreen");
const directScreenSelect = document.getElementById("directScreen");
const slotScreenSelect = document.getElementById("slotScreen");
const calScreenFilter = document.getElementById("calScreenFilter");

const screenForm = document.getElementById("screenForm");
const screenStatus = document.getElementById("screenStatus");
const screenEditForm = document.getElementById("screenEditForm");
const screenEditStatus = document.getElementById("screenEditStatus");
const editScreenSelect = document.getElementById("editScreenSelect");
const editGroupSelect = document.getElementById("editGroup");
const screenAssignList = document.getElementById("screenAssignList");

const screenshotModalEl = document.getElementById("screenshotModal");
const screenshotModalTitle = document.getElementById("screenshotModalTitle");
const screenshotStatus = document.getElementById("screenshotStatus");
const screenshotImage = document.getElementById("screenshotImage");
const screenshotDialog = screenshotModalEl ? createDialog(screenshotModalEl) : null;

document.querySelectorAll('[data-close="screenshot"]').forEach((btn) => {
  btn.addEventListener("click", () => screenshotDialog?.close());
});

const openScreenshot = async (screen) => {
  if (!screenshotDialog) return;
  screenshotImage.hidden = true;
  screenshotModalTitle.textContent = screen.name;
  screenshotStatus.textContent = "Requesting snapshot from player...";
  screenshotDialog.open();
  try {
    const data = await apiFetch(`/api/screens/${screen.id}/screenshot`, { method: "POST" });
    screenshotImage.src = data.dataUrl;
    screenshotImage.hidden = false;
    screenshotStatus.textContent = data.timestamp ? `Captured ${data.timestamp}` : "";
  } catch (err) {
    screenshotStatus.textContent = err.message;
  }
};

export const loadScreens = async () => {
  const data = await apiFetch("/api/screens");
  const screens = data.screens || [];
  state.screens = screens;
  screensGrid.innerHTML = "";
  linkScreenSelect.innerHTML = "";
  directScreenSelect.innerHTML = "";
  slotScreenSelect.innerHTML = "";

  screens.forEach((screen) => {
    const card = document.createElement("div");
    card.className = "screen-card";
    card.innerHTML = `
      <div class="screen-header">
        <div>
          <h3>${screen.name}</h3>
          <p class="meta">${screen.companyName}</p>
        </div>
        <span class="pill">${screen.group?.name || "No group"}</span>
      </div>
      <div class="requirements">
        <span class="label">Requirements</span>
        <p>MP4 · ${screen.prerequisite?.width || "?"}x${screen.prerequisite?.height || "?"}</p>
      </div>
      ${
        screen.brightSignSerial
          ? `<p class="meta">Status: <span class="pill pill-${screen.playbackStatus || "unknown"}">${screen.playbackStatus || "unknown"}</span></p>
             <button type="button" class="ghost screenshot-btn">Screenshot</button>`
          : ""
      }
    `;
    screensGrid.appendChild(card);

    card.querySelector(".screenshot-btn")?.addEventListener("click", () => openScreenshot(screen));

    const opt = document.createElement("option");
    opt.value = screen.id;
    opt.textContent = screen.name;
    linkScreenSelect.appendChild(opt);

    const directOpt = document.createElement("option");
    directOpt.value = screen.id;
    directOpt.textContent = screen.name;
    directScreenSelect.appendChild(directOpt);

    const slotOpt = document.createElement("option");
    slotOpt.value = screen.id;
    slotOpt.textContent = screen.name;
    slotScreenSelect.appendChild(slotOpt);
  });

  hydrateEditScreen();
  renderScreenAssignments();
  if (calScreenFilter) {
    await loadCalendar();
  }
  return screens;
};

export const hydrateEditScreen = () => {
  editScreenSelect.innerHTML = "";
  state.screens.forEach((screen) => {
    const opt = document.createElement("option");
    opt.value = screen.id;
    opt.textContent = screen.name;
    editScreenSelect.appendChild(opt);
  });
  const first = state.screens[0];
  if (first) {
    editScreenSelect.value = first.id;
    applyScreenToEdit(first);
  }
};

export const renderScreenAssignments = () => {
  if (!screenAssignList) return;
  const groups = state.groups;
  screenAssignList.innerHTML = "";
  if (!state.screens.length) {
    screenAssignList.innerHTML = `<div class="list-item muted">No screens yet.</div>`;
    return;
  }
  state.screens.forEach((screen) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const select = document.createElement("select");
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "No group";
    select.appendChild(noneOpt);
    groups.forEach((group) => {
      const opt = document.createElement("option");
      opt.value = group.id;
      opt.textContent = group.name;
      select.appendChild(opt);
    });
    select.value = screen.group?._id || screen.group?.id || "";
    select.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/screens/${screen.id}`, {
          method: "PATCH",
          body: JSON.stringify({ groupId: select.value || null }),
        });
        await loadScreens();
      } catch {
        select.value = screen.group?._id || screen.group?.id || "";
      }
    });

    row.innerHTML = `
      <strong>${screen.name}</strong>
      <div class="muted">${screen.companyName}</div>
    `;
    row.appendChild(select);
    screenAssignList.appendChild(row);
  });
};

export const applyScreenToEdit = (screen) => {
  if (!screen) return;
  screenEditForm.prereqWidth.value = screen.prerequisite?.width || "";
  screenEditForm.prereqHeight.value = screen.prerequisite?.height || "";
  screenEditForm.canvasWidth.value = screen.transform?.canvasWidth || "";
  screenEditForm.canvasHeight.value = screen.transform?.canvasHeight || "";
  screenEditForm.rotation.value = screen.transform?.rotation ?? 0;
  screenEditForm.scale.value = screen.transform?.scale ?? 1;
  screenEditForm.offsetX.value = screen.transform?.offsetX ?? 0;
  screenEditForm.offsetY.value = screen.transform?.offsetY ?? 0;
  screenEditForm.durationMinSec.value = screen.durationMinSec ?? "";
  screenEditForm.durationMaxSec.value = screen.durationMaxSec ?? "";
  screenEditForm.brightSignSerial.value = screen.brightSignSerial ?? "";
  screenEditForm.notifyEmails.value = (screen.notifyEmails || []).join(", ");
  editGroupSelect.value = screen.group?._id || screen.group?.id || "";
};

editScreenSelect?.addEventListener("change", () => {
  const screen = state.screens.find((s) => s.id === editScreenSelect.value);
  applyScreenToEdit(screen);
});

screenForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  screenStatus.textContent = "Creating screen...";
  try {
    const body = {
      name: screenForm.name.value,
      companyName: screenForm.companyName.value,
      owner: screenForm.owner.value,
      templateDir: screenForm.templateDir.value,
      destinationFolder: screenForm.destinationFolder.value,
      baseUrl: screenForm.baseUrl.value,
      prerequisite: {
        width: Number(screenForm.prereqWidth.value),
        height: Number(screenForm.prereqHeight.value),
      },
      transform: {
        canvasWidth: Number(screenForm.canvasWidth.value),
        canvasHeight: Number(screenForm.canvasHeight.value),
        rotation: Number(screenForm.rotation.value || 0),
        scale: Number(screenForm.scale.value || 1),
        offsetX: Number(screenForm.offsetX.value || 0),
        offsetY: Number(screenForm.offsetY.value || 0),
      },
      durationMinSec: screenForm.durationMinSec.value
        ? Number(screenForm.durationMinSec.value)
        : undefined,
      durationMaxSec: screenForm.durationMaxSec.value
        ? Number(screenForm.durationMaxSec.value)
        : undefined,
      groupId: screenForm.groupId.value || null,
    };
    await apiFetch("/api/screens", { method: "POST", body: JSON.stringify(body) });
    screenStatus.textContent = "Screen created.";
    screenForm.reset();
    await loadScreens();
  } catch (err) {
    screenStatus.textContent = err.message;
  }
});

screenEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  screenEditStatus.textContent = "Saving...";
  try {
    const screenId = screenEditForm.screenId.value;
    if (!screenId) {
      screenEditStatus.textContent = "Select a screen.";
      return;
    }
    const body = {
      groupId: screenEditForm.groupId.value || null,
      prerequisite: {
        width: Number(screenEditForm.prereqWidth.value),
        height: Number(screenEditForm.prereqHeight.value),
      },
      transform: {
        canvasWidth: Number(screenEditForm.canvasWidth.value),
        canvasHeight: Number(screenEditForm.canvasHeight.value),
        rotation: Number(screenEditForm.rotation.value || 0),
        scale: Number(screenEditForm.scale.value || 1),
        offsetX: Number(screenEditForm.offsetX.value || 0),
        offsetY: Number(screenEditForm.offsetY.value || 0),
      },
      durationMinSec: screenEditForm.durationMinSec.value
        ? Number(screenEditForm.durationMinSec.value)
        : undefined,
      durationMaxSec: screenEditForm.durationMaxSec.value
        ? Number(screenEditForm.durationMaxSec.value)
        : undefined,
      brightSignSerial: screenEditForm.brightSignSerial.value || null,
      notifyEmails: screenEditForm.notifyEmails.value
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    };
    await apiFetch(`/api/screens/${screenId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    screenEditStatus.textContent = "Screen updated.";
    await loadScreens();
  } catch (err) {
    screenEditStatus.textContent = err.message;
  }
});
