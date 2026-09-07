import type { LeaderboardEntry } from "@/types";

export function percentileValue(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

export function computePercentile(aura: number, allAura: number[]): number {
  if (allAura.length === 0) return 0;
  const below = allAura.filter((a) => a < aura).length;
  return (below / allAura.length) * 100;
}

export function computeHoldTimeDays(entry: LeaderboardEntry): number {
  // total_held_time_hours is amount-weighted (USD×hours) from the BULK API.
  // Divide by current balance to recover average hold duration in days.
  const usdHours =
    entry.total_held_time_hours ??
    (entry.total_held_time_seconds ? entry.total_held_time_seconds / 3600 : 0);
  const amount =
    entry.current_amount > 0 ? entry.current_amount : entry.deposited_amount;
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
