"use client";

import { useEffect, useState } from "react";

/** Tailwind `sm` is 640. Below that, Overview/Aura/Tools must stop sharing
 * a desktop row with a legend or a six-column table. */
export const NARROW_VIEWPORT_PX = 640;

export function useNarrowViewport(maxWidth = NARROW_VIEWPORT_PX): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [maxWidth]);

  return narrow;
}
