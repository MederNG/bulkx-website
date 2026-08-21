"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: ReactNode;
  className?: string;
  panelClassName?: string;
  /**
   * When true, the panel is rendered in a portal with fixed positioning and is
   * clamped to the viewport so the full content is always visible, regardless of
   * where the trigger sits on the page or how far the user has scrolled.
   */
  floating?: boolean;
}

export function InfoTooltip({ text, className, panelClassName, floating }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchPointer = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!floating || !open) return;

    const reposition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const margin = 8;
      const t = trigger.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = t.left + t.width / 2 - p.width / 2;
      left = Math.max(margin, Math.min(left, vw - p.width - margin));

      // Prefer above the trigger; if it would clip, drop below; then clamp.
      let top = t.top - p.height - margin;
      if (top < margin) top = t.bottom + margin;
      if (top + p.height > vh - margin) {
        top = Math.max(margin, vh - p.height - margin);
      }

      setCoords({ top, left });
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [floating, open, text]);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const panelClasses = cn(
    "z-50 rounded-lg border border-[var(--color-line-strong)] bg-[#17171a] p-3 text-left text-xs font-normal leading-relaxed text-text-secondary shadow-[0_12px_30px_rgba(0,0,0,0.45)]",
    floating ? "w-60" : "absolute bottom-full left-1/2 mb-2 w-60 -translate-x-1/2",
    panelClassName
  );

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More information"
        aria-expanded={open}
        onPointerDown={(event) => {
          touchPointer.current = event.pointerType !== "mouse";
          if (!touchPointer.current) return;
          event.preventDefault();
          setOpen((wasOpen) => !wasOpen);
        }}
        onMouseEnter={() => {
          if (!touchPointer.current) show();
        }}
        onMouseLeave={() => {
          if (!touchPointer.current) hide();
        }}
        onFocus={() => {
          if (!touchPointer.current) show();
        }}
        onBlur={() => {
          if (!touchPointer.current) hide();
        }}
        onClick={(event) => {
          if (event.detail !== 0) return;
          setOpen((wasOpen) => !wasOpen);
        }}
        className="help-dot flex h-[17px] w-[17px] cursor-default items-center justify-center rounded-full border text-[10.5px] font-semibold leading-none transition-colors focus:outline-none"
      >
        ?
      </button>

      {floating ? (
        mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.span
                ref={panelRef}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: coords?.top ?? -9999,
                  left: coords?.left ?? -9999,
                  visibility: coords ? "visible" : "hidden",
                }}
                className={panelClasses}
              >
                {text}
              </motion.span>
            )}
          </AnimatePresence>,
          document.body
        )
      ) : (
        <AnimatePresence>
          {open && (
            <motion.span
              role="tooltip"
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={panelClasses}
            >
              {text}
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </span>
  );
}
