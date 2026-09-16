import { apiFetch } from "./api.js";
import { state } from "./state.js";
import { renderScreenAssignments } from "./screens.js";

const groupForm = document.getElementById("groupForm");
const groupStatus = document.getElementById("groupStatus");
const groupList = document.getElementById("groupList");
const screenGroupSelect = document.getElementById("screenGroup");
const editGroupSelect = document.getElementById("editGroup");
const userGroupsSelect = document.getElementById("userGroups");

export const loadGroups = async () => {
  const data = await apiFetch("/api/groups");
  const groups = data.groups || [];
  state.groups = groups;
  groupList.innerHTML = "";
  screenGroupSelect.innerHTML = `<option value="">No group</option>`;
  editGroupSelect.innerHTML = `<option value="">No group</option>`;
  userGroupsSelect.innerHTML = "";

  groups.forEach((group) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${group.name}</strong>
      <div class="muted">${group.description || ""}</div>
      <div class="muted">Screens: ${group.screens.length}</div>
      <div class="muted">ID: ${group.id}</div>
    `;

    const notifyField = document.createElement("div");
    notifyField.className = "field";
    notifyField.innerHTML = `
      <label>Notify emails (comma-separated)</label>
      <input type="text" value="${(group.notifyEmails || []).join(", ")}" />
      <button type="button" class="ghost small">Save</button>
      <span class="status"></span>
    `;
    const notifyInput = notifyField.querySelector("input");
    const notifyStatus = notifyField.querySelector(".status");
    notifyField.querySelector("button").addEventListener("click", async () => {
      notifyStatus.textContent = "Saving...";
      try {
        const notifyEmails = notifyInput.value
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        await apiFetch(`/api/groups/${group.id}`, {
          method: "PATCH",
          body: JSON.stringify({ notifyEmails }),
        });
        notifyStatus.textContent = "Saved.";
      } catch (err) {
        notifyStatus.textContent = err.message;
      }
    });
    item.appendChild(notifyField);

    groupList.appendChild(item);

    const opt = document.createElement("option");
    opt.value = group.id;
    opt.textContent = group.name;
    screenGroupSelect.appendChild(opt);
    editGroupSelect.appendChild(opt.cloneNode(true));
    if (userGroupsSelect) {
      const userOpt = document.createElement("option");
      userOpt.value = group.id;
      userOpt.textContent = group.name;
      userGroupsSelect.appendChild(userOpt);
    }
  });

  renderScreenAssignments();
};

groupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  groupStatus.textContent = "Creating...";
  try {
    const body = {
      name: groupForm.name.value,
      description: groupForm.description.value,
      notifyEmails: groupForm.notifyEmails.value
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    };
    await apiFetch("/api/groups", { method: "POST", body: JSON.stringify(body) });
    groupStatus.textContent = "Group created.";
    groupForm.reset();
    await loadGroups();
  } catch (err) {
    groupStatus.textContent = err.message;
  }
});
