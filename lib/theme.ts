export const THEME_STORAGE_KEY = "bulk-theme";
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "dark";

/** Browser chrome colour per theme — kept in sync with --t-base. */
export const THEME_BG: Record<Theme, string> = {
  dark: "#141310",
  light: "#f9f8ed",
};

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/**
 * Paint the theme onto <html>. `data-theme` is what globals.css keys the
 * light palette off; `color-scheme` comes along for form controls,
 * scrollbars and the native focus ring.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_BG[theme]);
}

/**
 * Runs before first paint, inlined in <head>, so the stored theme is on the
 * element before anything renders — otherwise a light-mode visitor gets a
 * dark flash on every navigation. Stringified rather than imported because
 * it has to execute as a blocking script, not as hydrated React.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var t=(s==="dark"||s==="light")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":${JSON.stringify(DEFAULT_THEME)});
document.documentElement.dataset.theme=t;
document.documentElement.style.colorScheme=t;
}catch(e){}})();`;
