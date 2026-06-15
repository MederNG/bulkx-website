"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";

export type NumberFormat = "number" | "usd" | "usd-full" | "plain" | "percent" | "decimal3";

function formatValue(n: number, format: NumberFormat): string {
  switch (format) {
    case "number":
      return formatNumber(n);
    case "usd":
      return `$${formatNumber(n)}`;
    case "usd-full":
      return `$${Math.round(n).toLocaleString("en-US")}`;
    case "percent":
      return `${n.toFixed(1)}%`;
    case "decimal3":
      return n.toFixed(3);
    case "plain":
    default:
      return Math.round(n).toLocaleString("en-US");
  }
}

interface KpiTerminalCounterProps {
  value: number;
  format?: NumberFormat;
  /** Total count-up duration in ms. */
  durationMs?: number;
  className?: string;
}

export function KpiTerminalCounter({
  value,
  format = "plain",
  durationMs = 800,
  className,
}: KpiTerminalCounterProps) {
  const [displayed, setDisplayed] = useState(0);
  const [counting, setCounting] = useState(false);
  const rafRef = useRef<number | null>(null);
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);

  useEffect(() => {
    if (hasEnteredViewport) return;
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasEnteredViewport]);

  useEffect(() => {
    if (!hasEnteredViewport) {
      setDisplayed(0);
      setCounting(false);
      return;
    }

    let cancelled = false;
    setCounting(true);
    setDisplayed(0);

    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplayed(Math.round(value * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      setDisplayed(value);
      setCounting(false);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [hasEnteredViewport, value, durationMs]);

  return (
    <span ref={hostRef} className={cn("kpi-number", counting && "is-counting", className)}>
      {formatValue(displayed, format)}
    </span>
  );
}
