"use client";

import { useEffect, useRef } from "react";
import {
  CURSOR_DISPLAY_SIZE,
  CURSOR_HOTSPOT_DISPLAY_X,
  CURSOR_HOTSPOT_DISPLAY_Y,
} from "@/lib/cursor-config";

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, select, textarea, label, summary, [data-cursor-hover]';

export function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -9999, y: -9999 });
  const visibleRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pressedRef = useRef(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer) return;

    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return;

    const enableNativeHide = () => {
      document.documentElement.classList.add("custom-cursor-ready");
    };

    const applyFrame = () => {
      rafRef.current = null;
      const { x, y } = posRef.current;
      root.style.transform = `translate3d(${x - CURSOR_HOTSPOT_DISPLAY_X}px, ${y - CURSOR_HOTSPOT_DISPLAY_Y}px, 0)`;
      root.style.opacity = visibleRef.current ? "1" : "0";
    };

    const scheduleFrame = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(applyFrame);
    };

    const setScale = (scale: number, durationMs: number) => {
      inner.style.transitionDuration = `${durationMs}ms`;
      inner.style.transform = `scale(${scale})`;
    };

    const updateHover = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const interactive = target?.closest(INTERACTIVE_SELECTOR) ?? null;
      if (pressedRef.current) return;
      setScale(interactive && !reducedMotion ? 1.05 : 1, 120);
    };

    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      posRef.current = { x: event.clientX, y: event.clientY };
      visibleRef.current = true;
      enableNativeHide();
      updateHover(event.clientX, event.clientY);
      scheduleFrame();
    };

    const onPointerLeave = (event: MouseEvent) => {
      const related = event.relatedTarget as Node | null;
      if (related && document.documentElement.contains(related)) return;
      visibleRef.current = false;
      scheduleFrame();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        visibleRef.current = false;
        scheduleFrame();
      }
    };

    const onPointerDown = () => {
      pressedRef.current = true;
      if (!reducedMotion) setScale(0.92, 80);
    };

    const onPointerUp = (event: PointerEvent) => {
      pressedRef.current = false;
      updateHover(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.documentElement.addEventListener("mouseout", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.documentElement.classList.remove("custom-cursor-ready");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.documentElement.removeEventListener("mouseout", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="custom-cursor-root pointer-events-none fixed left-0 top-0 z-[99999] will-change-transform"
      aria-hidden="true"
    >
      <div
        ref={innerRef}
        className="custom-cursor-inner"
        style={{
          width: CURSOR_DISPLAY_SIZE,
          height: CURSOR_DISPLAY_SIZE,
          transformOrigin: `${CURSOR_HOTSPOT_DISPLAY_X}px ${CURSOR_HOTSPOT_DISPLAY_Y}px`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cursor/mouse.png"
          alt=""
          width={CURSOR_DISPLAY_SIZE}
          height={CURSOR_DISPLAY_SIZE}
          draggable={false}
          className="block h-full w-full select-none"
        />
      </div>
    </div>
  );
}
