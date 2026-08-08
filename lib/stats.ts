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
import { getLiveTotals } from "@/lib/live-totals";
import { getLeaderboardTop } from "@/lib/leaderboard-table";
import { hasReferralActivity } from "@/lib/referrals";
import { AURA_BUCKETS, categoryLabel } from "@/lib/utils";
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

export async function computeDashboardMetrics(): Promise<DashboardMetrics> {
  const entries = await getLeaderboardForApp({ waitMs: 4000 });
  const snapshots = readSnapshots();
  const totals = await getLiveTotals();
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
  tab: "aura" | "deposit" | "efficiency" | "referral",
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

export function getRankTargetsFromData() {
  const entries = getLeaderboard();
  return getRankTargets(entries.map((e) => e.aura));
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
