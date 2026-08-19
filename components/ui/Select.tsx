"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  compact?: boolean;
}

interface MenuCoords {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

export function Select({ value, onChange, options, className, compact }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const t = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = t.width;
      const left = Math.max(margin, Math.min(t.left, vw - width - margin));
      const spaceBelow = vh - t.bottom - gap - margin;
      const spaceAbove = t.top - gap - margin;
      const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;

      setCoords(
        openDown
          ? { top: t.bottom + gap, left, width, maxHeight: Math.max(160, spaceBelow) }
          : { bottom: vh - t.top + gap, left, width, maxHeight: Math.max(160, spaceAbove) }
      );
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, options.length]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left font-sans transition-colors outline-none",
          compact
            ? "rounded-[10px] border bg-[var(--color-bulk-base)] px-2.5 py-1.5 text-[13px]"
            : "input-field",
          open
            ? "border-accent"
            : compact
              ? "border-[var(--color-line-strong)] hover:border-[rgba(255,181,71,0.4)]"
              : undefined
        )}
      >
        <span className="min-w-0 truncate text-text-primary">{selected?.label ?? "Select..."}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-muted transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.ul
                ref={listRef}
                role="listbox"
                initial={{ opacity: 0, y: coords?.bottom != null ? 8 : -8, scaleY: 0.96 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: coords?.bottom != null ? 8 : -8, scaleY: 0.96 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  top: coords?.top,
                  bottom: coords?.bottom,
                  left: coords?.left ?? 0,
                  width: coords?.width,
                  maxHeight: coords?.maxHeight,
                  visibility: coords ? "visible" : "hidden",
                  transformOrigin: coords?.bottom != null ? "bottom" : "top",
                }}
                className={cn(
                  "z-50 overflow-x-hidden overflow-y-auto rounded-[10px] border border-[var(--color-line-strong)] bg-[var(--color-bulk-base)] p-1 font-sans shadow-[0_12px_30px_rgba(0,0,0,0.45)]",
                  compact ? "text-[13px]" : "text-sm"
                )}
              >
                {options.map((o) => {
                  const active = o.value === value;
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md text-left transition-colors",
                          compact ? "h-[30px] px-2.5" : "px-3 py-2",
                          active
                            ? "bg-[rgba(255,181,71,0.12)] text-accent"
                            : "text-text-secondary hover:bg-[rgba(255,181,71,0.06)] hover:text-text-primary"
                        )}
                      >
                        {o.label}
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
