"use client";

import type { Snapshot } from "@/types";
import { TvlSectionCards } from "@/components/cards/LiveFinancialMetrics";
import { TvlChart } from "@/components/charts/Charts";
import { useLiveFinancials } from "@/components/live/LiveFinancialProvider";

interface TvlAnalyticsProps {
  snapshots: Snapshot[];
}

export function TvlAnalytics({ snapshots }: TvlAnalyticsProps) {
  const {
    currentTvl,
    totalDeposited,
    totalWithdrawn,
    projection,
    secondaryMetrics,
    referenceTimeMs,
  } = useLiveFinancials();

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
