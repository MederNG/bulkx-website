"use client";

import { useEffect, useRef } from "react";

const SHIMMER_DURATION_MS = 2000;

export function HeroIntelligenceTitle() {
  const shineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const el = shineRef.current;
    if (!el) return;

    const from = 180;
    const to = -80;
    const startedAt = performance.now();
    let frame = 0;

    const setMaskPosition = (pos: number) => {
      const value = `${pos}% 50%`;
      el.style.maskPosition = value;
      el.style.setProperty("-webkit-mask-position", value);
    };

    setMaskPosition(from);

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / SHIMMER_DURATION_MS, 1);
      setMaskPosition(from + (to - from) * progress);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

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
