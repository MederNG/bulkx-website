import type { LeaderboardEntry } from "@/types";
import { computeDepositAura, computeEfficiency } from "@/lib/percentiles";
import { hasReferralActivity } from "@/lib/referrals";

export const LEADERBOARD_TOP_LIMIT = 100;

export type LeaderboardTab = "aura" | "deposit" | "efficiency" | "referral";
export type LeaderboardSortDir = "asc" | "desc";

export const LEADERBOARD_TAB_DEFAULT_SORT: Record<
  LeaderboardTab,
  { key: string; dir: LeaderboardSortDir }
> = {
  aura: { key: "aura", dir: "desc" },
  deposit: { key: "deposit", dir: "desc" },
  efficiency: { key: "efficiency", dir: "desc" },
  referral: { key: "referrals_qualified", dir: "desc" },
};

export function getLeaderboardPool(
  entries: LeaderboardEntry[],
  tab: LeaderboardTab
): LeaderboardEntry[] {
  switch (tab) {
    case "efficiency":
      return entries.filter(
        (entry) => entry.deposited_amount > 0 && computeDepositAura(entry) > 0
      );
    case "referral":
      return entries.filter(hasReferralActivity);
    default:
      return entries;
  }
}

export function getLeaderboardSortValue(
  entry: LeaderboardEntry,
  tab: LeaderboardTab,
  sortKey: string
): number | string {
  switch (sortKey) {
    case "aura_rank":
      return entry.aura_rank;
    case "deposit_rank":
      return entry.deposit_rank;
    case "wallet":
      return entry.wallet;
    case "aura":
      return tab === "efficiency" ? computeDepositAura(entry) : entry.aura;
    case "deposit":
      return entry.current_amount;
    case "efficiency":
      return computeEfficiency(entry);
    case "referees_total_deposited":
      return entry.referees_total_deposited ?? 0;
    case "referrals_sent":
      return entry.referrals_sent;
    case "referrals_qualified":
      return entry.referrals_qualified;
    default:
      return getLeaderboardSortValue(
        entry,
        tab,
        LEADERBOARD_TAB_DEFAULT_SORT[tab].key
      );
  }
}

export function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
  tab: LeaderboardTab,
  sortKey: string,
  sortDir: LeaderboardSortDir
): LeaderboardEntry[] {
  const copy = [...entries];

  copy.sort((a, b) => {
    const aVal = getLeaderboardSortValue(a, tab, sortKey);
    const bVal = getLeaderboardSortValue(b, tab, sortKey);

    if (typeof aVal === "string" && typeof bVal === "string") {
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "desc" ? -cmp : cmp;
    }

    const diff = Number(aVal) - Number(bVal);
    return sortDir === "desc" ? -diff : diff;
  });

  return copy;
}

export function getLeaderboardTop(
  entries: LeaderboardEntry[],
  tab: LeaderboardTab,
  sortKey?: string,
  sortDir?: LeaderboardSortDir,
  limit = LEADERBOARD_TOP_LIMIT
): LeaderboardEntry[] {
  const defaults = LEADERBOARD_TAB_DEFAULT_SORT[tab];
  const key = sortKey ?? defaults.key;
  const dir = sortDir ?? defaults.dir;
  const pool = getLeaderboardPool(entries, tab);
  const sorted = sortLeaderboardEntries(pool, tab, key, dir);
  return sorted.slice(0, limit);
}
