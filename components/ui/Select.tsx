"use client";

import { useEffect, useRef, useState } from "react";
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
}

export function Select({ value, onChange, options, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded border bg-bulk-base px-3.5 py-2.5 text-left text-sm transition-colors outline-none",
          open
            ? "border-accent"
            : "border-[rgba(198,182,186,0.2)] hover:border-[rgba(255,181,71,0.4)]"
        )}
      >
        <span className="text-text-primary">{selected?.label ?? "Select..."}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-accent transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute z-30 mt-2 w-full overflow-hidden rounded border border-[rgba(255,181,71,0.25)] bg-bg-primary p-1 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
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
                      "flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors",
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
      </AnimatePresence>
    </div>
  );
}
