"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Icon-only theme switch. A track with both marks always visible and a knob
 * that slides between them, so the control reads as a switch at a glance
 * rather than as a button whose meaning you have to infer.
 *
 * The knob is the only moving part; the two icons sit under it and change
 * emphasis, which keeps the hit target stable while the state is obvious.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Dark theme" : "Light theme"}
      onClick={toggleTheme}
      className={cn(
        "theme-toggle relative inline-flex h-[26px] w-[50px] shrink-0 items-center",
        "rounded-full border border-[var(--color-line-strong)] bg-[rgb(var(--t-veil-rgb)/0.06)]",
        "transition-colors duration-200 hover:border-accent/60",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {/* Knob. Sits above the marks and carries the accent. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 z-10 flex h-[20px] w-[20px] -translate-y-1/2",
          "items-center justify-center rounded-full bg-accent",
          "transition-[left] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          isLight ? "left-[26px]" : "left-[2px]",
        )}
      >
        {isLight ? (
          <Sun size={12} strokeWidth={2.4} className="text-bulk-base" />
        ) : (
          <Moon size={12} strokeWidth={2.4} className="text-bulk-base" />
        )}
      </span>

      {/* Resting marks — the one the knob is not covering stays legible. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-[6px] top-1/2 -translate-y-1/2 transition-opacity duration-200",
          isLight ? "opacity-45" : "opacity-0",
        )}
      >
        <Moon size={12} strokeWidth={2.2} className="text-text-muted" />
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-[6px] top-1/2 -translate-y-1/2 transition-opacity duration-200",
          isLight ? "opacity-0" : "opacity-45",
        )}
      >
        <Sun size={12} strokeWidth={2.2} className="text-text-muted" />
      </span>
    </button>
  );
}
