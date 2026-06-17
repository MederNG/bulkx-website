export const CUSTOM_CURSOR_STORAGE_KEY = "aura-custom-cursor-enabled";

export const CUSTOM_CURSOR_PREFERENCE_EVENT = "custom-cursor-preference-change";

export function readCustomCursorEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY);
  if (stored === null) return false;
  return stored === "true";
}

export function writeCustomCursorEnabled(enabled: boolean) {
  window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent(CUSTOM_CURSOR_PREFERENCE_EVENT, { detail: { enabled } })
  );
}

export function syncCustomCursorDocumentClass(enabled: boolean) {
  document.documentElement.classList.toggle("custom-cursor-disabled", !enabled);
  if (!enabled) {
    document.documentElement.classList.remove("custom-cursor-ready");
  }
}
