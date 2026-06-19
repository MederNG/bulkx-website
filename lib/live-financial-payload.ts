import type { DepositAuraPredictContext } from "@/lib/deposit-aura-predict";
import { getLeaderboard } from "@/lib/fetcher";
import { getLiveTotals } from "@/lib/live-totals";
import { computeProjectedSnapshotTvl, type ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import { getChartSnapshots, getDepositAuraPredictContext } from "@/lib/stats";
import {
  computeTvlKpiSecondaryMetrics,
  type TvlKpiSecondaryMetrics,
} from "@/lib/tvl-kpi-secondary";

export interface LiveFinancialPayload {
  currentTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  depositWallets: number;
  updatedAt: string;
  referenceTimeMs: number;
  projection: ProjectedSnapshotTvl;
  secondaryMetrics: TvlKpiSecondaryMetrics;
  depositPredict: DepositAuraPredictContext;
}

export async function buildLiveFinancialPayload(options?: {
  fresh?: boolean;
}): Promise<LiveFinancialPayload> {
  const totals = await getLiveTotals(options);
  const entries = getLeaderboard();
  const snapshots = getChartSnapshots("ALL");

  const currentTvl =
    totals?.tvl ?? entries.reduce((sum, entry) => sum + entry.current_amount, 0);
  const totalDeposited =
    totals?.totalDeposited ?? entries.reduce((sum, entry) => sum + entry.deposited_amount, 0);
  const totalWithdrawn =
    totals?.totalWithdrawn ?? entries.reduce((sum, entry) => sum + entry.withdrawn_amount, 0);
  const depositWallets = totals?.totalWallets ?? entries.length;
  const updatedAt =
    totals?.updatedAt ??
    (snapshots.length > 0
      ? snapshots[snapshots.length - 1].timestamp
      : new Date().toISOString());
  const referenceTimeMs = options?.fresh ? Date.now() : Date.parse(updatedAt);

  const projection = computeProjectedSnapshotTvl(snapshots, currentTvl, referenceTimeMs);
  const secondaryMetrics = computeTvlKpiSecondaryMetrics(
    snapshots,
    currentTvl,
    totalDeposited,
    totalWithdrawn,
    referenceTimeMs,
  );
  const depositPredict = getDepositAuraPredictContext(currentTvl, referenceTimeMs);

  return {
    currentTvl,
    totalDeposited,
    totalWithdrawn,
    depositWallets,
    updatedAt,
    referenceTimeMs,
    projection,
    secondaryMetrics,
    depositPredict,
  };
}
