"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CUSTOM_CURSOR_PREFERENCE_EVENT,
  readCustomCursorEnabled,
  syncCustomCursorDocumentClass,
  writeCustomCursorEnabled,
} from "@/lib/custom-cursor-preference";

const DESKTOP_CURSOR_QUERY = "(pointer: fine) and (hover: hover)";

export function useCustomCursorPreference() {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_CURSOR_QUERY);
    const syncDesktop = () => setIsDesktop(media.matches);
    syncDesktop();
    media.addEventListener("change", syncDesktop);

    const nextEnabled = readCustomCursorEnabled();
    setEnabledState(nextEnabled);
    syncCustomCursorDocumentClass(nextEnabled);
    setReady(true);

    const onPreferenceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled: boolean }>).detail;
      if (typeof detail?.enabled !== "boolean") return;
      setEnabledState(detail.enabled);
      syncCustomCursorDocumentClass(detail.enabled);
    };

    window.addEventListener(CUSTOM_CURSOR_PREFERENCE_EVENT, onPreferenceChange);
    return () => {
      media.removeEventListener("change", syncDesktop);
      window.removeEventListener(CUSTOM_CURSOR_PREFERENCE_EVENT, onPreferenceChange);
      document.documentElement.classList.remove("custom-cursor-disabled", "custom-cursor-ready");
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    writeCustomCursorEnabled(next);
    setEnabledState(next);
    syncCustomCursorDocumentClass(next);
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, setEnabled, toggle, ready, isDesktop };
}
