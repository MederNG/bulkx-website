import type { LeaderboardEntry } from "@/types";
import { NextRequest, NextResponse } from "next/server";
import { getLeaderboardWithLiveFinancials } from "@/lib/live-leaderboard-financials";
import { attachExchangeStats } from "@/lib/volume-leaderboard";
import {
  LEADERBOARD_TAB_DEFAULT_SORT,
  LEADERBOARD_TOP_LIMIT,
  getLeaderboardTop,
  type LeaderboardSortDir,
  type LeaderboardTab,
} from "@/lib/leaderboard-table";

export const revalidate = 300;

const VALID_TABS: LeaderboardTab[] = ["aura", "volume", "pnl"];

const TOP_CACHE_MS = 30_000;
const topCache = new Map<string, { at: number; items: LeaderboardEntry[] }>();

export async function GET(request: NextRequest) {
  const tabParam = request.nextUrl.searchParams.get("tab") ?? "aura";
  const selectedTab = VALID_TABS.includes(tabParam as LeaderboardTab)
    ? (tabParam as LeaderboardTab)
    : "aura";

  const defaults = LEADERBOARD_TAB_DEFAULT_SORT[selectedTab];
  const sortKey = request.nextUrl.searchParams.get("sort") ?? defaults.key;
  const dirParam = request.nextUrl.searchParams.get("dir");
  const sortDir: LeaderboardSortDir =
    dirParam === "asc" || dirParam === "desc" ? dirParam : defaults.dir;

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? LEADERBOARD_TOP_LIMIT);
  const limit = Math.min(
    LEADERBOARD_TOP_LIMIT,
    Math.max(1, Number.isFinite(limitParam) ? limitParam : LEADERBOARD_TOP_LIMIT)
  );

  const cacheKey = `${selectedTab}:${sortKey}:${sortDir}:${limit}`;
  const cached = topCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TOP_CACHE_MS) {
    return NextResponse.json({
      items: cached.items,
      total: cached.items.length,
      tab: selectedTab,
      sort: sortKey,
      dir: sortDir,
      limit,
    });
  }

  const entries = attachExchangeStats(await getLeaderboardWithLiveFinancials());
  const items = getLeaderboardTop(entries, selectedTab, sortKey, sortDir, limit);
  topCache.set(cacheKey, { at: Date.now(), items });

  return NextResponse.json({
    items,
    total: items.length,
    tab: selectedTab,
    sort: sortKey,
    dir: sortDir,
    limit,
  });
}
