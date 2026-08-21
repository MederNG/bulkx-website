import { chartSlateRamp } from "@/lib/overview-metrics";

/** Shared beat for gold selection pulse — Framer Motion, not CSS.
 * CSS opacity/filter animations on SVG cancel in Chromium while Safari
 * (phones) still runs them; driving opacity from motion keeps both in sync. */
export const CHART_GOLD_PULSE = {
  opacity: [1, 0.38, 1],
} as const;

export const CHART_GOLD_PULSE_TRANSITION = {
  duration: 1.15,
  repeat: Infinity,
  ease: "easeInOut" as const,
};

/** Slate bed under a pulsing primary mark. Idle primary is already gold, so
 * without this the phases read gold→gold and the beat disappears; secondaries
 * keep their own slate as the bed. */
export const CHART_GOLD_PULSE_UNDERLAY = chartSlateRamp(0, 3);
