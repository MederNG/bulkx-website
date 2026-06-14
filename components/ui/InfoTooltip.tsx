"use client";

import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: ReactNode;
  className?: string;
  panelClassName?: string;
}

export function InfoTooltip({ text, className, panelClassName }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="text-text-secondary transition-colors hover:text-accent focus:text-accent focus:outline-none"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded border border-[rgba(255,181,71,0.25)] bg-bg-primary p-3 text-left text-xs leading-relaxed font-normal text-text-secondary shadow-[0_12px_30px_rgba(0,0,0,0.45)]",
              panelClassName
            )}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
