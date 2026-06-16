"use client";

import { motion, useReducedMotion } from "framer-motion";

const SHIMMER_GRADIENT =
  "linear-gradient(90deg, transparent 0%, transparent 24%, rgba(190, 180, 165, 1) 34%, rgba(255, 255, 255, 1) 46%, rgba(165, 185, 210, 1) 50%, rgba(255, 255, 255, 1) 54%, rgba(190, 180, 165, 1) 64%, transparent 74%, transparent 100%)";

export function HeroIntelligenceTitle() {
  const reduceMotion = useReducedMotion();

  return (
    <h1 className="hero-intelligence-title-wrap text-3xl md:text-5xl">
      <span className="hero-intelligence-title-base">INTELLIGENCE</span>
      {!reduceMotion ? (
        <motion.span
          aria-hidden
          className="hero-intelligence-title-shine"
          style={{
            backgroundImage: SHIMMER_GRADIENT,
          }}
          initial={{ backgroundPosition: "170% 50%" }}
          animate={{ backgroundPosition: "-70% 50%" }}
          transition={{
            duration: 2,
            ease: "linear",
          }}
        >
          INTELLIGENCE
        </motion.span>
      ) : null}
    </h1>
  );
}
