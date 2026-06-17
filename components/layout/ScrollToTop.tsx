"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SHOW_AFTER_PX = 320;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        "scroll-to-top-btn fixed right-4 bottom-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,181,71,0.35)] bg-[rgba(27,26,20,0.92)] text-accent shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-[opacity,transform] duration-200 md:right-6 md:bottom-8",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <span className="scroll-to-top-float flex items-center justify-center">
        <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
      </span>
    </button>
  );
}
