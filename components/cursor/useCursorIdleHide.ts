"use client";

import { useEffect, useState } from "react";

export const CURSOR_IDLE_MS = 10_000;
export const CURSOR_IDLE_CLASS = "cursor-idle";
export const CURSOR_IDLE_CHANGE_EVENT = "cursor-idle-change";

const DESKTOP_POINTER_QUERY = "(pointer: fine) and (hover: hover)";

export function isCursorIdle(): boolean {
  return document.documentElement.classList.contains(CURSOR_IDLE_CLASS);
}

export function useIsDesktopPointer(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_POINTER_QUERY);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

export function useCursorIdleHide(active: boolean): boolean {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (!active) {
      setIsIdle(false);
      document.documentElement.classList.remove(CURSOR_IDLE_CLASS);
      return;
    }

    let idleTimer: number | null = null;

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const setIdle = (idle: boolean) => {
      setIsIdle(idle);
      document.documentElement.classList.toggle(CURSOR_IDLE_CLASS, idle);
      window.dispatchEvent(new CustomEvent(CURSOR_IDLE_CHANGE_EVENT, { detail: { idle } }));
    };

    const hideAfterIdle = () => {
      setIdle(true);
    };

    const wake = () => {
      setIdle(false);
      clearIdleTimer();
      idleTimer = window.setTimeout(hideAfterIdle, CURSOR_IDLE_MS);
    };

    const onPointerMove = () => {
      wake();
    };

    const onPointerLeave = (event: MouseEvent) => {
      const related = event.relatedTarget as Node | null;
      if (related && document.documentElement.contains(related)) return;
      clearIdleTimer();
      setIdle(false);
    };

    const onVisibilityChange = () => {
      clearIdleTimer();
      if (document.hidden) return;
      setIdle(true);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("mouseout", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    idleTimer = window.setTimeout(hideAfterIdle, CURSOR_IDLE_MS);

    return () => {
      clearIdleTimer();
      document.documentElement.classList.remove(CURSOR_IDLE_CLASS);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      document.documentElement.removeEventListener("mouseout", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active]);

  return isIdle;
}
