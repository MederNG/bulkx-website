import { getLeaderboard } from "@/lib/fetcher";
import {
  fetchAllLeaderboardFinancialRows,
  financialRowsToMap,
  mergeFinancialRow,
  recomputeDepositRanks,
  type LeaderboardFinancialPage,
  type LeaderboardFinancialRow,
} from "@/lib/leaderboard-financial-sync";
import { upstreamFetch } from "@/lib/upstream";
import type { LeaderboardEntry } from "@/types";

const CACHE_MS = 300_000;
const PAGE_SIZE = 2000;

let cache: { at: number; map: Map<string, LeaderboardFinancialRow> } | null = null;
let inflight: Promise<Map<string, LeaderboardFinancialRow>> | null = null;

async function fetchFinancialPage(
  page: number,
  pageSize: number,
  noTotal: boolean
): Promise<LeaderboardFinancialPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (noTotal) params.set("no_total", "true");

  const res = await upstreamFetch(`/v1/aura/predeposit/leaderboard?${params.toString()}`, {
    revalidate: 300,
  });
  if (!res.ok) {
    throw new Error(`Leaderboard financial fetch failed: ${res.status}`);
  }
  return (await res.json()) as LeaderboardFinancialPage;
}

async function loadFinancialMap(): Promise<Map<string, LeaderboardFinancialRow>> {
  const rows = await fetchAllLeaderboardFinancialRows(fetchFinancialPage, {
    pageSize: PAGE_SIZE,
    pageDelayMs: 0,
  });
  const map = financialRowsToMap(rows);
  cache = { at: Date.now(), map };
  return map;
}

/** Cached wallet → latest deposit/withdraw/TVL from upstream (refreshed ~5 min). */
export async function getLiveFinancialMap(): Promise<Map<string, LeaderboardFinancialRow>> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.map;
  }

  if (!inflight) {
    inflight = loadFinancialMap()
      .catch((err) => {
        if (cache) return cache.map;
        throw err;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function getLeaderboardWithLiveFinancials(): Promise<LeaderboardEntry[]> {
  const entries = getLeaderboard();
  if (!entries.length) return entries;

  try {
    const map = await getLiveFinancialMap();
    const merged = entries.map((entry) => mergeFinancialRow(entry, map.get(entry.wallet)));
    recomputeDepositRanks(merged);
    return merged;
  } catch {
    return entries;
  }
}

export function clearLiveLeaderboardFinancialsCache(): void {
  cache = null;
  inflight = null;
}
