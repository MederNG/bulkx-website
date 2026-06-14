"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// Fractions of the final value that each milestone lands on.
// Intentionally dense and front-loaded to create a fast "terminal burst".
const MILESTONE_FRACTIONS = [
  0,
  0.0001,
  0.0002,
  0.0004,
  0.0007,
  0.001,
  0.0016,
  0.0025,
  0.0036,
  0.005,
  0.0068,
  0.009,
  0.0118,
  0.015,
  0.019,
  0.024,
  0.0295,
  0.036,
  0.0435,
  0.052,
  0.062,
  0.074,
  0.087,
  0.102,
  0.119,
  0.138,
  0.16,
  0.184,
  0.212,
  0.242,
  0.276,
  0.314,
  0.356,
  0.402,
  0.452,
  0.506,
  0.562,
  0.622,
  0.68,
  0.736,
  0.786,
  0.83,
  0.868,
  0.902,
  0.924,
  0.942,
  0.95,
  0.958,
  0.966,
  0.972,
  0.978,
  0.983,
  0.987,
  0.99,
  0.992,
  0.994,
  0.996,
  0.997,
  0.998,
  0.9987,
  0.9992,
  0.9996,
  1,
];

interface KpiTerminalCounterProps {
  value: number;
  format?: NumberFormat;
  /** Time between milestone jumps, in ms. */
  stepMs?: number;
  className?: string;
}

export function KpiTerminalCounter({
  value,
  format = "plain",
  stepMs = 70,
  className,
}: KpiTerminalCounterProps) {
  const milestones = useMemo(() => {
    const last = MILESTONE_FRACTIONS.length - 1;
    return MILESTONE_FRACTIONS.map((fraction, i) =>
      i === last ? value : Math.round(value * fraction)
    );
  }, [value]);

  const [index, setIndex] = useState(0);
  const [counting, setCounting] = useState(true);
  const rafRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null);
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
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasEnteredViewport]);

  useEffect(() => {
    const last = milestones.length - 1;

    if (last <= 0) {
      setIndex(last);
      setCounting(false);
      return;
    }

    if (!hasEnteredViewport) {
      setIndex(0);
      setCounting(false);
      return;
    }

    setIndex(0);
    setCounting(true);

    let cancelled = false;

    const scheduleAfter = (ms: number, cb: () => void) => {
      let start = 0;
      const wait = (now: number) => {
        if (cancelled) return;
        if (start === 0) start = now;
        if (now - start >= ms) {
          cb();
          return;
        }
        rafRef.current = requestAnimationFrame(wait);
      };
      rafRef.current = requestAnimationFrame(wait);
    };

    const runStep = (nextIndex: number) => {
      if (cancelled) return;
      setIndex(nextIndex);
      if (nextIndex >= last) {
        setCounting(false);
        return;
      }
      scheduleAfter(stepMs, () => {
        if (cancelled) return;
        // Commit each milestone on its own paint tick (no catch-up jump).
        rafRef.current = requestAnimationFrame(() => runStep(nextIndex + 1));
      });
    };

    const start = () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(() => runStep(1));
    };

    // Start only when the browser has idle time; this avoids running the whole
    // sequence while hydration/chart work is still blocking paints.
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleRef.current = win.requestIdleCallback(start, { timeout: 2000 });
    } else {
      rafRef.current = requestAnimationFrame(() => scheduleAfter(300, start));
    }

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (idleRef.current !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleRef.current);
      }
    };
    // Re-runs on mount (each page load / full refresh) and if the value changes.
  }, [hasEnteredViewport, milestones, stepMs]);

  const displayedValue = milestones[index] ?? value;

  return (
    <span ref={hostRef} className={cn("kpi-number", counting && "is-counting", className)}>
      {formatValue(displayedValue, format)}
    </span>
  );
}
