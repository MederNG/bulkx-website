import type { DepositAuraPredictContext } from "@/lib/deposit-aura-predict";
import { getLeaderboard, getLeaderboardMtimeMs } from "@/lib/fetcher";
import { getLeaderboardForApp } from "@/lib/live-leaderboard";
import { getLiveTotals } from "@/lib/live-totals";
import { computeProjectedSnapshotTvl, type ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import { getSnapshotsMtimeMs } from "@/lib/snapshots";
import { getChartSnapshots, getDepositAuraPredictContext } from "@/lib/stats";
import { getTotalsMtimeMs, readTotals } from "@/lib/totals";
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
 * refreshes from /api/live-financials after paint.
 *
 * Assembling this walks the full leaderboard (~52k rows) plus weekly Aura
 * pools. The root layout re-renders on every client navigation, so the
 * result is cached against the three source files' mtimes. */
let diskPayloadCache: { key: string; data: LiveFinancialPayload } | null = null;

export function buildLiveFinancialPayloadFromDisk(): LiveFinancialPayload {
  const key = `${getLeaderboardMtimeMs()}:${getTotalsMtimeMs()}:${getSnapshotsMtimeMs()}`;
  if (diskPayloadCache?.key === key) return diskPayloadCache.data;
  const data = assembleLiveFinancialPayload(readTotals(), getLeaderboard());
  diskPayloadCache = { key, data };
  return data;
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
