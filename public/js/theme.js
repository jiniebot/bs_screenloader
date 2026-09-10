const toggleBtn = document.getElementById("themeToggle");

const systemPrefersDark = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

const currentTheme = () => document.documentElement.getAttribute("data-theme") || (systemPrefersDark() ? "dark" : "light");

const updateIcon = () => {
  if (!toggleBtn) return;
  toggleBtn.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
};

updateIcon();

toggleBtn?.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    // ignore (private browsing / storage disabled)
  }
  updateIcon();
});
