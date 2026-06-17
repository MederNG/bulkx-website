"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "#lookup", label: "Lookup" },
  { href: "#analytics", label: "Analytics" },
  { href: "#leaderboards", label: "Leaderboards" },
  { href: "#calculator", label: "Calculator" },
] as const;

export function NavMoreMenu() {
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

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "btn-ghost btn-ghost-header inline-flex items-center gap-1",
          open && "text-accent"
        )}
      >
        More
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-accent transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute right-0 z-30 mt-2 min-w-[10.5rem] overflow-hidden rounded border border-[rgba(255,181,71,0.25)] bg-bg-primary p-1 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
          >
            {NAV_ITEMS.map((item) => (
              <li key={item.href} role="none">
                <a
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-[rgba(255,181,71,0.06)] hover:text-text-primary"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
