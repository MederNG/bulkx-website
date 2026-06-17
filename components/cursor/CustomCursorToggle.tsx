"use client";

import { cn } from "@/lib/utils";
import { useCustomCursorPreference } from "@/components/cursor/useCustomCursorPreference";

export function CustomCursorToggle() {
  const { enabled, toggle, ready, isDesktop } = useCustomCursorPreference();

  if (!ready || !isDesktop) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "border-0 bg-transparent p-0 text-[11px] tracking-wide text-text-secondary underline-offset-2 transition-colors hover:text-text-primary hover:underline",
        !enabled && "text-accent hover:text-accent"
      )}
      aria-pressed={enabled}
    >
      {enabled ? "Disable Bulkie" : "Enable Bulkie"}
    </button>
  );
}
