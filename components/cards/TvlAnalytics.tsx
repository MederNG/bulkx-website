"use client";

import type { Snapshot } from "@/types";
import type { ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import type { TvlKpiSecondaryMetrics } from "@/lib/tvl-kpi-secondary";
import { TvlSectionCards } from "@/components/cards/LiveFinancialMetrics";
import { TvlChart } from "@/components/charts/Charts";

interface TvlAnalyticsProps {
  snapshots: Snapshot[];
  currentTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  projection: ProjectedSnapshotTvl;
  secondaryMetrics: TvlKpiSecondaryMetrics;
  referenceTimeMs: number;
}

export function TvlAnalytics({
  snapshots,
  currentTvl,
  totalDeposited,
  totalWithdrawn,
  projection,
  secondaryMetrics,
  referenceTimeMs,
}: TvlAnalyticsProps) {
  return (
    <>
      <TvlSectionCards
        currentTvl={currentTvl}
        totalDeposited={totalDeposited}
        totalWithdrawn={totalWithdrawn}
        projection={projection}
        secondaryMetrics={secondaryMetrics}
      />
      <TvlChart
        data={snapshots}
        currentTvl={currentTvl}
        projection={projection}
        referenceTimeMs={referenceTimeMs}
      />
    </>
  );
}
