"use client";

import { useEffect, useRef } from "react";

const FADE_IN_MS = 1000;
const SWEEP_MS = 2000;
const FADE_OUT_MS = 1000;
const TOTAL_MS = FADE_IN_MS + SWEEP_MS + FADE_OUT_MS;

function easeIn(t: number) {
  return t * t;
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

export function HeroIntelligenceTitle() {
  const shineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const el = shineRef.current;
    if (!el) return;

    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - startedAt;

      if (elapsed >= TOTAL_MS) {
        el.style.opacity = "0";
        el.style.backgroundPosition = "200% 50%";
        return;
      }

      if (elapsed < FADE_IN_MS) {
        const t = elapsed / FADE_IN_MS;
        el.style.opacity = String(easeIn(t));
        el.style.backgroundPosition = "-200% 50%";
      } else if (elapsed < FADE_IN_MS + SWEEP_MS) {
        const t = (elapsed - FADE_IN_MS) / SWEEP_MS;
        el.style.opacity = "1";
        el.style.backgroundPosition = `${-200 + 400 * t}% 50%`;
      } else {
        const t = (elapsed - FADE_IN_MS - SWEEP_MS) / FADE_OUT_MS;
        el.style.opacity = String(1 - easeOut(t));
        el.style.backgroundPosition = "200% 50%";
      }

      frame = requestAnimationFrame(tick);
    };

    el.style.opacity = "0";
    el.style.backgroundPosition = "-200% 50%";
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <h1 className="hero-intelligence-title-wrap text-3xl md:text-5xl">
      <span className="hero-intelligence-title-base">INTELLIGENCE</span>
      <span ref={shineRef} className="hero-intelligence-title-shine" aria-hidden="true">
        INTELLIGENCE
      </span>
    </h1>
  );
}
