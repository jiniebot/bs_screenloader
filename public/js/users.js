import { apiFetch } from "./api.js";

const userForm = document.getElementById("userForm");
const userStatus = document.getElementById("userStatus");
const userGroupsSelect = document.getElementById("userGroups");

userForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  userStatus.textContent = "Creating user...";
  try {
    const groupIds = Array.from(userGroupsSelect?.selectedOptions || []).map(
      (opt) => opt.value,
    );
    const body = {
      name: userForm.name.value,
      email: userForm.email.value,
      password: userForm.password.value,
      role: userForm.role.value,
      groupIds,
    };
    await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(body) });
    userStatus.textContent = "User created.";
    userForm.reset();
  } catch (err) {
    userStatus.textContent = err.message;
  }
});
