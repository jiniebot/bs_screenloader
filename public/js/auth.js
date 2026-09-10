import { apiFetch } from "./api.js";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const bootstrapForm = document.getElementById("bootstrapForm");
const bootstrapStatus = document.getElementById("bootstrapStatus");
const logoutBtn = document.getElementById("logoutBtn");
const userBadge = document.getElementById("userBadge");

export const setAuthState = (isAuthed) => {
  authView.hidden = isAuthed;
  appView.hidden = !isAuthed;
  logoutBtn.style.display = isAuthed ? "inline-flex" : "none";
};

export const checkBootstrap = async () => {
  try {
    const data = await apiFetch("/api/auth/bootstrap/status");
    if (!data.available) {
      bootstrapForm?.classList.add("hidden");
    } else {
      bootstrapForm?.classList.remove("hidden");
    }
  } catch {
    bootstrapForm?.classList.add("hidden");
  }
};

export const setUserBadge = (user) => {
  userBadge.textContent = user ? `${user.name} · ${user.role}` : "";
};

// Wires the login/bootstrap/logout forms. `onAuthSuccess` re-runs the app's
// data load after a successful login or bootstrap, and `onLogout` resets it.
export function initAuth({ onAuthSuccess, onLogout }) {
  setAuthState(false);

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginStatus.textContent = "Signing in...";
    try {
      const body = {
        email: loginForm.email.value,
        password: loginForm.password.value,
      };
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      loginStatus.textContent = "";
      loginForm.reset();
      await onAuthSuccess();
    } catch (err) {
      loginStatus.textContent = err.message;
    }
  });

  bootstrapForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    bootstrapStatus.textContent = "Creating admin...";
    try {
      const body = {
        name: bootstrapForm.name.value,
        email: bootstrapForm.email.value,
        password: bootstrapForm.password.value,
      };
      await apiFetch("/api/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify(body),
      });
      bootstrapStatus.textContent = "Admin created.";
      bootstrapForm.reset();
      await onAuthSuccess();
    } catch (err) {
      bootstrapStatus.textContent = err.message;
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — cookie may already be gone
    }
    setUserBadge(null);
    setAuthState(false);
    onLogout?.();
  });
}
