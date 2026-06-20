import type { LeaderboardEntry } from "@/types";

export function percentileValue(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

export function getRankThreshold(sortedDesc: number[], rank: number): number {
  if (sortedDesc.length === 0) return 0;
  return sortedDesc[Math.min(rank - 1, sortedDesc.length - 1)] ?? 0;
}

export function computePercentile(aura: number, allAura: number[]): number {
  if (allAura.length === 0) return 0;
  const below = allAura.filter((a) => a < aura).length;
  return (below / allAura.length) * 100;
}

export function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return numerator / (n * sum);
}

export function computeLorenzCurve(values: number[]): { cumulativeWallets: number; cumulativeAura: number }[] {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  // Downsample to a fixed number of points so the chart stays smooth and the
  // payload/render stays light even with tens of thousands of wallets.
  const TARGET_POINTS = 160;
  const n = sorted.length;
  const stride = Math.max(1, Math.floor(n / TARGET_POINTS));

  const points: { cumulativeWallets: number; cumulativeAura: number }[] = [
    { cumulativeWallets: 0, cumulativeAura: 0 },
  ];
  let running = 0;

  for (let i = 0; i < n; i++) {
    running += sorted[i];
    if (i % stride === 0 || i === n - 1) {
      points.push({
        cumulativeWallets: ((i + 1) / n) * 100,
        cumulativeAura: (running / total) * 100,
      });
    }
  }

  return points;
}

export function computeTopShare(values: number[], topN: number): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const top = sorted.slice(0, topN).reduce((a, b) => a + b, 0);
  return (top / total) * 100;
}

export function computeHoldTimeDays(entry: LeaderboardEntry): number {
  // total_held_time_hours is amount-weighted (USD×hours) from the BULK API.
  // Divide by deposited balance to recover average hold duration in days.
  const usdHours =
    entry.total_held_time_hours ??
    (entry.total_held_time_seconds ? entry.total_held_time_seconds / 3600 : 0);
  const amount =
    entry.deposited_amount > 0 ? entry.deposited_amount : entry.current_amount;
  if (!usdHours || usdHours <= 0 || !amount || amount <= 0) return 0;
  return Math.round(usdHours / amount / 24);
}

export function computeDepositAura(entry: LeaderboardEntry): number {
  // Deposit-only aura: base weekly deposit-holding categories (week1, week2, ...).
  // Excludes retro_*, referral_*, and week*_protocol_* (protocol-specific bonuses).
  let total = 0;
  for (const [key, val] of Object.entries(entry.categories ?? {})) {
    if (/^week\d+$/.test(key)) {
      total += Number(val) || 0;
    }
  }
  return total;
}

export function computeEfficiency(entry: LeaderboardEntry): number {
  if (entry.deposited_amount <= 0) return 0;
  return computeDepositAura(entry) / entry.deposited_amount;
}

/**
 * Thresholds to be "in the top X%" of the distribution.
 *
 * "Top 1%" means you score higher than 99% of participants, so the threshold
 * is the 99th percentile of the aura distribution (computed on the ascending
 * array). Rank thresholds (top 100/50/10) are the Nth-highest aura value.
 */
export function getRankTargets(auraValues: number[]) {
  const asc = [...auraValues].sort((a, b) => a - b);
  const desc = [...auraValues].sort((a, b) => b - a);
  return {
    top10Percent: percentileValue(asc, 90),
    top5Percent: percentileValue(asc, 95),
    top1Percent: percentileValue(asc, 99),
    top100: getRankThreshold(desc, 100),
    top50: getRankThreshold(desc, 50),
    top10: getRankThreshold(desc, 10),
  };
}

export function computeFdv(
  userAura: number,
  fdv: number,
  allocationPercent: number,
  totalAuraSupply: number
) {
  const poolValue = fdv * (allocationPercent / 100);
  const auraValue = totalAuraSupply > 0 ? poolValue / totalAuraSupply : 0;
  const userValue = userAura * auraValue;
  return { poolValue, auraValue, userValue };
}
