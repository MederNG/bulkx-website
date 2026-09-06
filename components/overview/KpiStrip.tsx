"use client";

import { VolumeStatCard } from "@/components/overview/VolumeStatCard";
import { OiStatCard } from "@/components/overview/OiStatCard";
import { TradersStatCard } from "@/components/overview/TradersStatCard";

/** Headline strip: volume, open interest, active traders. */
export function KpiStrip() {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
      <VolumeStatCard />
      <OiStatCard />
      <TradersStatCard />
    </div>
  );
}
