import type { DepositAuraPredictContext } from "@/lib/deposit-aura-predict";
import { getLeaderboard } from "@/lib/fetcher";
import { getLeaderboardForApp } from "@/lib/live-leaderboard";
import { getLiveTotals } from "@/lib/live-totals";
import { computeProjectedSnapshotTvl, type ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import { getChartSnapshots, getDepositAuraPredictContext } from "@/lib/stats";
import { readTotals } from "@/lib/totals";
import type { LeaderboardEntry, Totals } from "@/types";
import {
  computeTvlKpiSecondaryMetrics,
  type TvlKpiSecondaryMetrics,
} from "@/lib/tvl-kpi-secondary";

export interface LiveFinancialPayload {
  currentTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  depositWallets: number;
  totalAura: number;
  totalWallets: number;
  updatedAt: string;
  referenceTimeMs: number;
  projection: ProjectedSnapshotTvl;
  secondaryMetrics: TvlKpiSecondaryMetrics;
  depositPredict: DepositAuraPredictContext;
}

function assembleLiveFinancialPayload(
  totals: Totals | null,
  entries: LeaderboardEntry[],
  options?: { fresh?: boolean },
): LiveFinancialPayload {
  const snapshots = getChartSnapshots("ALL");

  const currentTvl =
    totals?.tvl ?? entries.reduce((sum, entry) => sum + entry.current_amount, 0);
  const totalDeposited =
    totals?.totalDeposited ?? entries.reduce((sum, entry) => sum + entry.deposited_amount, 0);
  const totalWithdrawn =
    totals?.totalWithdrawn ?? entries.reduce((sum, entry) => sum + entry.withdrawn_amount, 0);
  const depositWallets = totals?.totalWallets ?? entries.length;
  const totalAura = entries.reduce((sum, entry) => sum + entry.aura, 0);
  const totalWallets = totals?.leaderboardWallets ?? entries.length;
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
  const depositPredict = getDepositAuraPredictContext(currentTvl, referenceTimeMs, entries);

  return {
    currentTvl,
    totalDeposited,
    totalWithdrawn,
    depositWallets,
    totalAura,
    totalWallets,
    updatedAt,
    referenceTimeMs,
    projection,
    secondaryMetrics,
    depositPredict,
  };
}

/** Sync disk snapshot for the root layout — no upstream fetch, so tab
 * switches are not blocked on a dynamic layout. The client provider
 * refreshes from /api/live-financials after paint. */
export function buildLiveFinancialPayloadFromDisk(): LiveFinancialPayload {
  return assembleLiveFinancialPayload(readTotals(), getLeaderboard());
}

export async function buildLiveFinancialPayload(options?: {
  fresh?: boolean;
  /** Max wait for upstream leaderboard before disk fallback. Default 1500ms. */
  waitMs?: number;
}): Promise<LiveFinancialPayload> {
  const waitMs = options?.waitMs ?? 1_500;
  const [totals, entries] = await Promise.all([
    getLiveTotals(options),
    getLeaderboardForApp({ waitMs }),
  ]);
  return assembleLiveFinancialPayload(totals, entries, options);
}
