"use client";

import { motion, useReducedMotion } from "framer-motion";

export function HeroIntelligenceTitle() {
  const reduceMotion = useReducedMotion();

  return (
    <h1 className="relative inline-block overflow-hidden text-3xl font-medium uppercase tracking-[0.06em] text-[#fffeef] md:text-5xl">
      INTELLIGENCE
      {!reduceMotion ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-[-35%] h-[170%] w-[36%] -skew-x-[14deg]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(120, 110, 95, 0.85) 26%, rgba(255, 255, 255, 1) 48%, rgba(95, 110, 130, 0.95) 54%, rgba(120, 110, 95, 0.85) 74%, transparent 100%)",
            mixBlendMode: "soft-light",
          }}
          initial={{ left: "-40%" }}
          animate={{ left: ["-40%", "110%"] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            repeatDelay: 18.8,
            ease: "linear",
          }}
        />
      ) : null}
    </h1>
  );
}
