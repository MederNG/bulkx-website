/** SVG viewBox and fingertip hotspot (1024×1024 source space). */
export const CURSOR_VIEWBOX = 1024;
export const CURSOR_HOTSPOT_X = 234;
export const CURSOR_HOTSPOT_Y = 81;

/** Rendered cursor size in CSS pixels. */
export const CURSOR_DISPLAY_SIZE = 72;

export const CURSOR_HOTSPOT_DISPLAY_X =
  (CURSOR_HOTSPOT_X / CURSOR_VIEWBOX) * CURSOR_DISPLAY_SIZE;
export const CURSOR_HOTSPOT_DISPLAY_Y =
  (CURSOR_HOTSPOT_Y / CURSOR_VIEWBOX) * CURSOR_DISPLAY_SIZE;

/** CSS cursor fallback hotspot for the 48px PNG. */
export const CURSOR_FALLBACK_HOTSPOT_X = Math.round((CURSOR_HOTSPOT_X / CURSOR_VIEWBOX) * 48);
export const CURSOR_FALLBACK_HOTSPOT_Y = Math.round((CURSOR_HOTSPOT_Y / CURSOR_VIEWBOX) * 48);
