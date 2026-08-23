import type { DepositAuraPredictContext } from "@/lib/deposit-aura-predict";
import { getLeaderboard, getLeaderboardMtimeMs } from "@/lib/fetcher";
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

/** Shared by the live-financials route and in-process callers so every open
 * tab does not rebuild the 52k-row payload. */
export const LIVE_PAYLOAD_TTL_MS = 45_000;

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

let livePayloadCache: { at: number; data: LiveFinancialPayload } | null = null;

/**
 * Live KPI payload for the client poll. Totals come from the cheap
 * page_size=1 upstream (already cached 5 min). Leaderboard Aura / predict
 * stay on the disk snapshot — starting a full 26-page pull here is what
 * burned Fluid Active CPU. Result is reused for LIVE_PAYLOAD_TTL_MS.
 */
export async function buildLiveFinancialPayload(): Promise<LiveFinancialPayload> {
  const now = Date.now();
  if (livePayloadCache && now - livePayloadCache.at < LIVE_PAYLOAD_TTL_MS) {
    return livePayloadCache.data;
  }

  const totals = await getLiveTotals();
  const base = buildLiveFinancialPayloadFromDisk();

  if (!totals) {
    livePayloadCache = { at: now, data: base };
    return base;
  }

  const snapshots = getChartSnapshots("ALL");
  const referenceTimeMs = now;
  const data: LiveFinancialPayload = {
    ...base,
    currentTvl: totals.tvl,
    totalDeposited: totals.totalDeposited,
    totalWithdrawn: totals.totalWithdrawn,
    depositWallets: totals.totalWallets,
    totalWallets: totals.leaderboardWallets ?? base.totalWallets,
    updatedAt: totals.updatedAt,
    referenceTimeMs,
    projection: computeProjectedSnapshotTvl(snapshots, totals.tvl, referenceTimeMs),
    secondaryMetrics: computeTvlKpiSecondaryMetrics(
      snapshots,
      totals.tvl,
      totals.totalDeposited,
      totals.totalWithdrawn,
      referenceTimeMs,
    ),
  };

  livePayloadCache = { at: now, data };
  return data;
}
