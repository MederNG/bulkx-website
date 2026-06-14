import { getLeaderboard } from "@/lib/fetcher";
import {
  computeEfficiency,
  computeDepositAura,
  computeGini,
  computeLorenzCurve,
  computePercentile,
  computeTopShare,
  estimateWalletAgeDays,
  getRankTargets,
  percentileValue,
} from "@/lib/percentiles";
import { filterSnapshotsByRange, readSnapshots } from "@/lib/snapshots";
import { AURA_BUCKETS, categoryLabel } from "@/lib/utils";
import type {
  ChartRange,
  DashboardMetrics,
  LeaderboardEntry,
  Snapshot,
  WalletData,
} from "@/types";

export function computeDashboardMetrics(): DashboardMetrics {
  const entries = getLeaderboard();
  const auraValues = entries.map((e) => e.aura);
  const sortedAuraAsc = [...auraValues].sort((a, b) => a - b);

  const currentTvl = entries.reduce((s, e) => s + e.current_amount, 0);
  const totalDeposited = entries.reduce((s, e) => s + e.deposited_amount, 0);
  const totalWithdrawn = entries.reduce((s, e) => s + e.withdrawn_amount, 0);
  const totalAura = auraValues.reduce((a, b) => a + b, 0);
  const qualifiedReferrals = entries.reduce((s, e) => s + e.referrals_qualified, 0);

  const categoryTotals: Record<string, number> = {};
  for (const entry of entries) {
    for (const [key, val] of Object.entries(entry.categories ?? {})) {
      categoryTotals[key] = (categoryTotals[key] ?? 0) + val;
    }
  }

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, points]) => ({
      category: categoryLabel(category),
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

  const referralCandidates = entries.filter((e) => e.referrals_qualified > 0);

  const topReferrers = [...referralCandidates]
    .sort((a, b) => b.referrals_qualified - a.referrals_qualified || b.aura - a.aura)
    .slice(0, 20);

  const topEfficiency = [...entries]
    .filter((e) => e.deposited_amount > 0 && computeDepositAura(e) > 0)
    .map((e) => ({ ...e, efficiency: computeEfficiency(e) }))
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 20);

  const targets = getRankTargets(auraValues);
  const alphaInsights = generateAlphaInsights(entries, sortedAuraAsc, categoryBreakdown, topEfficiency, topReferrers);

  return {
    totalWallets: entries.length,
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
    lastUpdated: new Date().toISOString(),
  };
}

function generateAlphaInsights(
  entries: LeaderboardEntry[],
  sortedAuraAsc: number[],
  categories: { category: string; points: number; share: number }[],
  topEfficiency: (LeaderboardEntry & { efficiency: number })[],
  topReferrers: LeaderboardEntry[]
): string[] {
  const insights: string[] = [];
  const median = percentileValue(sortedAuraAsc, 50);
  const top1 = percentileValue(sortedAuraAsc, 99);

  insights.push(`Top 1% threshold sits at ${top1.toLocaleString()} Aura — ${entries.length.toLocaleString()} wallets tracked.`);

  if (median > 0) {
    insights.push(`Median Aura is ${median.toLocaleString()} across the campaign.`);
  }

  if (categories.length > 0) {
    insights.push(`Fastest growing category: ${categories[0].category} (${categories[0].share.toFixed(1)}% share).`);
  }

  if (topEfficiency[0]) {
    insights.push(`Most efficient wallet: ${topEfficiency[0].wallet.slice(0, 8)}... (${topEfficiency[0].efficiency.toFixed(2)} Aura/$).`);
  }

  if (topReferrers[0]) {
    insights.push(`Highest referral performer: ${topReferrers[0].wallet.slice(0, 8)}... (${topReferrers[0].referrals_qualified} qualified).`);
  }

  const tvl = entries.reduce((s, e) => s + e.current_amount, 0);
  insights.push(`Current TVL: $${tvl.toLocaleString()} across ${entries.length.toLocaleString()} wallets.`);

  return insights;
}

export function getWalletData(address: string): WalletData | null {
  const entries = getLeaderboard();
  const entry = entries.find((e) => e.wallet.toLowerCase() === address.toLowerCase());
  if (!entry) return null;

  const allAura = entries.map((e) => e.aura);
  return {
    ...entry,
    percentile: computePercentile(entry.aura, allAura),
    wallet_age_estimate_days: estimateWalletAgeDays(entry),
    efficiency: computeEfficiency(entry),
  };
}

export function getSortedLeaderboard(
  tab: "aura" | "deposit" | "efficiency" | "referral"
): LeaderboardEntry[] {
  const entries = getLeaderboard();

  switch (tab) {
    case "deposit":
      return [...entries].sort((a, b) => a.deposit_rank - b.deposit_rank);
    case "efficiency":
      return [...entries]
        .filter((e) => e.deposited_amount > 0 && computeDepositAura(e) > 0)
        .sort((a, b) => computeEfficiency(b) - computeEfficiency(a));
    case "referral":
      return [...entries].sort(
        (a, b) => b.referrals_qualified - a.referrals_qualified || b.aura - a.aura
      );
    default:
      return [...entries].sort((a, b) => a.aura_rank - b.aura_rank);
  }
}

export function getChartSnapshots(range: ChartRange): Snapshot[] {
  const snapshots = readSnapshots();
  return filterSnapshotsByRange(snapshots, range);
}

export function getRankTargetsFromData() {
  const entries = getLeaderboard();
  return getRankTargets(entries.map((e) => e.aura));
}
