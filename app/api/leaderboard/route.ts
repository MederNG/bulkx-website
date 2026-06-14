import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/fetcher";
import {
  LEADERBOARD_TAB_DEFAULT_SORT,
  LEADERBOARD_TOP_LIMIT,
  getLeaderboardTop,
  type LeaderboardSortDir,
  type LeaderboardTab,
} from "@/lib/leaderboard-table";

export const revalidate = 300;

const VALID_TABS: LeaderboardTab[] = ["aura", "deposit", "efficiency", "referral"];

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

  const items = getLeaderboardTop(getLeaderboard(), selectedTab, sortKey, sortDir, limit);

  return NextResponse.json({
    items,
    total: items.length,
    tab: selectedTab,
    sort: sortKey,
    dir: sortDir,
    limit,
  });
}
