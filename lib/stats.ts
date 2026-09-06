import { unstable_cache } from "next/cache";
import { getLeaderboard } from "@/lib/fetcher";
import { getLeaderboardForApp } from "@/lib/live-leaderboard";
import {
  computeEfficiency,
  computeDepositAura,
  computeGini,
  computeLorenzCurve,
  computeTopShare,
  getRankTargets,
  percentileValue,
} from "@/lib/percentiles";
import { filterSnapshotsByRange, readSnapshots } from "@/lib/snapshots";
import { readTotals } from "@/lib/totals";
import { getLeaderboardTop } from "@/lib/leaderboard-table";
import { hasReferralActivity } from "@/lib/referrals";
import { AURA_BUCKETS, DEPOSITOR_AURA_RANGES, categoryLabel } from "@/lib/utils";
import { computeDepositAuraPredictContext } from "@/lib/deposit-aura-predict";
import { buildWalletData } from "@/lib/wallet-data";
import type {
  AlphaInsight,
  ChartRange,
  DashboardMetrics,
  LeaderboardEntry,
  Snapshot,
  WalletData,
} from "@/types";

const DEPOSIT_SIZE_BUCKETS = [
  { label: "<$100", min: 0, max: 100 },
  { label: "$100-1K", min: 100, max: 1_000 },
  { label: "$1K-10K", min: 1_000, max: 10_000 },
  { label: "$10K-100K", min: 10_000, max: 100_000 },
  { label: "$100K-500K", min: 100_000, max: 500_000 },
  { label: "$500K-1M", min: 500_000, max: 1_000_000 },
  { label: "$1M+", min: 1_000_000, max: Infinity },
];

async function computeDashboardMetricsUncached(): Promise<DashboardMetrics> {
  const entries = await getLeaderboardForApp({ waitMs: 0 });
  const snapshots = readSnapshots();
  const totals = readTotals();
  const lastUpdated =
    totals?.updatedAt ??
    (snapshots.length > 0
      ? snapshots[snapshots.length - 1].timestamp
      : new Date().toISOString());
  const auraValues = entries.map((e) => e.aura);
  const sortedAuraAsc = [...auraValues].sort((a, b) => a - b);

  // TVL / deposited / withdrawn are fetched live from upstream (hourly git
  // snapshots are a fallback when the API is unreachable).
  const currentTvl = totals?.tvl ?? entries.reduce((s, e) => s + e.current_amount, 0);
  const totalDeposited =
    totals?.totalDeposited ?? entries.reduce((s, e) => s + e.deposited_amount, 0);
  const totalWithdrawn =
    totals?.totalWithdrawn ?? entries.reduce((s, e) => s + e.withdrawn_amount, 0);
  const totalAura = auraValues.reduce((a, b) => a + b, 0);
  const qualifiedReferrals = entries.reduce((s, e) => s + e.referrals_qualified, 0);
  // "OG Hodlers" — earned Aura during week 1 and never withdrawn since.
  // `first_seen` is unpopulated on every real entry, so `categories.week1`
  // (points earned that week) is the only honest signal for "was already
  // depositing in week 1" available in the data.
  const ogHodlers = entries.filter(
    (e) => e.deposited_amount > 0 && e.withdrawn_amount === 0 && (e.categories?.week1 ?? 0) > 0
  ).length;

  const depositSizeDistribution = DEPOSIT_SIZE_BUCKETS.map((bucket) => {
    // Filtered once and then counted and summed, rather than filtered twice:
    // this runs over every leaderboard entry for each of seven buckets.
    const inBucket = entries.filter(
      (e) =>
        e.deposited_amount > 0 &&
        e.deposited_amount >= bucket.min &&
        e.deposited_amount < bucket.max
    );
    return {
      bucket: bucket.label,
      count: inBucket.length,
      // Net of withdrawals, and floored per wallet: a wallet that took out
      // more than it put in still holds nothing, not a negative balance that
      // would quietly cancel out someone else's deposit.
      held: inBucket.reduce(
        (sum, e) => sum + Math.max(0, e.deposited_amount - e.withdrawn_amount),
        0
      ),
      aura: inBucket.reduce((sum, e) => sum + (Number(e.aura) || 0), 0),
      // Typical Aura in the cohort, not raw min/max — a few empty or
      // outlier wallets otherwise pin every band to "0–…".
      auraMin: percentileValue(
        [...inBucket.map((e) => e.aura)].sort((a, b) => a - b),
        10
      ),
      auraMax: percentileValue(
        [...inBucket.map((e) => e.aura)].sort((a, b) => a - b),
        90
      ),
    };
  });

  const auraRangeDistribution = DEPOSITOR_AURA_RANGES.map((bucket) => {
    const inBucket = entries.filter((e) => {
      if (!(e.deposited_amount > 0)) return false;
      const aura = Number(e.aura) || 0;
      if (bucket.max === Infinity) return aura >= bucket.min;
      return aura >= bucket.min && aura < bucket.max;
    });
    return {
      bucket: bucket.label,
      id: bucket.id,
      count: inBucket.length,
      held: inBucket.reduce(
        (sum, e) => sum + Math.max(0, e.deposited_amount - e.withdrawn_amount),
        0
      ),
      aura: inBucket.reduce((sum, e) => sum + (Number(e.aura) || 0), 0),
      auraMin: bucket.min,
      auraMax: bucket.max === Infinity ? bucket.min : bucket.max,
    };
  });

  const categoryTotals: Record<string, number> = {};
  for (const entry of entries) {
    for (const [key, val] of Object.entries(entry.categories ?? {})) {
      categoryTotals[key] = (categoryTotals[key] ?? 0) + val;
    }
  }

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([key, points]) => ({
      key,
      category: categoryLabel(key),
      points,
      share: totalAura > 0 ? (points / totalAura) * 100 : 0,
    }))
    .sort((a, b) => b.points - a.points);

  const auraDistribution = AURA_BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: entries.filter((e) => {
      if (bucket.max === Infinity) return e.aura >= bucket.min;
      if (bucket.min === 0 && bucket.max === 0) return e.aura === 0;
      return e.aura >= bucket.min && e.aura < bucket.max;
    }).length,
  }));

  const referralCandidates = entries.filter(hasReferralActivity);

  const topReferrers = [...referralCandidates]
    .sort((a, b) => b.referrals_qualified - a.referrals_qualified || b.aura - a.aura)
    .slice(0, 20);

  const topEfficiency = [...entries]
    .filter((e) => e.deposited_amount > 0 && computeDepositAura(e) > 0)
    .map((e) => ({ ...e, efficiency: computeEfficiency(e) }))
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 20);

  const targets = getRankTargets(auraValues);
  const alphaInsights = generateAlphaInsights(entries, sortedAuraAsc, topEfficiency, topReferrers);

  return {
    totalWallets: totals?.leaderboardWallets ?? entries.length,
    depositWallets: totals?.totalWallets ?? entries.length,
    currentTvl,
    totalDeposited,
    totalWithdrawn,
    totalAura,
    qualifiedReferrals,
    depositSizeDistribution,
    auraRangeDistribution,
    ogHodlers,
    medianAura: percentileValue(sortedAuraAsc, 50),
    averageAura: entries.length ? totalAura / entries.length : 0,
    top10Threshold: targets.top10Percent,
    top5Threshold: targets.top5Percent,
    top1Threshold: targets.top1Percent,
    top10Share: computeTopShare(auraValues, 10),
    top100Share: computeTopShare(auraValues, 100),
    top1000Share: computeTopShare(auraValues, 1000),
    giniCoefficient: computeGini(auraValues),
    lorenzCurve: computeLorenzCurve(auraValues),
    auraDistribution,
    categoryBreakdown,
    topReferrers,
    referralCandidates,
    topEfficiency,
    alphaInsights,
    lastUpdated,
  };
}

export const computeDashboardMetrics = unstable_cache(
  computeDashboardMetricsUncached,
  ["dashboard-metrics-v3"],
  { revalidate: 60 },
);

function generateAlphaInsights(
  entries: LeaderboardEntry[],
  sortedAuraAsc: number[],
  topEfficiency: (LeaderboardEntry & { efficiency: number })[],
  topReferrers: LeaderboardEntry[]
): AlphaInsight[] {
  const insights: AlphaInsight[] = [];
  const median = percentileValue(sortedAuraAsc, 50);
  const top1 = percentileValue(sortedAuraAsc, 99);

  insights.push({
    label: "Top 1% Threshold",
    value: `${top1.toLocaleString()} Aura`,
    detail: `${entries.length.toLocaleString()} wallets tracked`,
  });

  if (median > 0) {
    insights.push({
      label: "Median Aura",
      value: median.toLocaleString(),
      detail: "across the campaign",
    });
  }

  if (topEfficiency[0]) {
    insights.push({
      label: "Most Efficient Wallet",
      value: `${topEfficiency[0].efficiency.toFixed(2)} Aura/$`,
      detail: `${topEfficiency[0].wallet.slice(0, 8)}...`,
      mono: true,
      copyValue: topEfficiency[0].wallet,
    });
  }

  if (topReferrers[0]) {
    insights.push({
      label: "Top Referral Performer",
      value: `${topReferrers[0].referrals_qualified} qualified`,
      detail: `${topReferrers[0].wallet.slice(0, 8)}...`,
      mono: true,
      copyValue: topReferrers[0].wallet,
    });
  }

  return insights;
}

export function getWalletData(address: string): WalletData | null {
  const entries = getLeaderboard();
  const entry = entries.find((e) => e.wallet.toLowerCase() === address.toLowerCase());
  if (!entry) return null;

  const allAura = entries.map((e) => e.aura);
  return buildWalletData(entry, allAura);
}

export function getSortedLeaderboard(
  tab: "aura" | "volume" | "pnl",
  sortKey?: string,
  sortDir?: "asc" | "desc",
  limit?: number
): LeaderboardEntry[] {
  return getLeaderboardTop(getLeaderboard(), tab, sortKey, sortDir, limit);
}

export function getChartSnapshots(range: ChartRange): Snapshot[] {
  const snapshots = readSnapshots();
  return filterSnapshotsByRange(snapshots, range);
}

export function getDepositAuraPredictContext(
  currentTvl: number,
  nowMs: number = Date.now(),
  entries?: LeaderboardEntry[]
) {
  return computeDepositAuraPredictContext(
    entries ?? getLeaderboard(),
    currentTvl,
    nowMs,
    readSnapshots()
  );
}
