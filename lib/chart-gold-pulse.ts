import type { Transition } from "framer-motion";
import { chartSlateRamp } from "@/lib/overview-metrics";

/** Shared beat for gold selection pulse — Framer Motion, not CSS.
 * CSS opacity/filter animations on SVG cancel in Chromium while Safari
 * (phones) still runs them; driving opacity from motion keeps both in sync.
 * Not `as const`: Framer's animate prop rejects readonly keyframe tuples. */
export const CHART_GOLD_PULSE = {
  opacity: [1, 0.38, 1],
};

export const CHART_GOLD_PULSE_TRANSITION: Transition = {
  duration: 1.15,
  repeat: Infinity,
  ease: "easeInOut",
};

/** Slate bed under a pulsing primary mark. Idle primary is already gold, so
 * without this the phases read gold→gold and the beat disappears; secondaries
 * keep their own slate as the bed. */
export const CHART_GOLD_PULSE_UNDERLAY = chartSlateRamp(0, 3);
