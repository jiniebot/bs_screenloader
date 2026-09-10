const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Wraps a modal element with focus-trapping, Escape-to-close, and
// focus restore — the browser gives none of this for free on a plain <div>.
export function createDialog(dialogEl, { onClose } = {}) {
  let lastFocused = null;

  const getFocusable = () =>
    Array.from(dialogEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null,
    );

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  function open() {
    lastFocused = document.activeElement;
    dialogEl.classList.add("active");
    dialogEl.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleKeydown);
    getFocusable()[0]?.focus();
  }

  function close() {
    if (!dialogEl.classList.contains("active")) return;
    dialogEl.classList.remove("active");
    dialogEl.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleKeydown);
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
    onClose?.();
  }

  return { open, close };
}
