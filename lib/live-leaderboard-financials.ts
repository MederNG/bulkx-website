import { getLeaderboardForApp } from "@/lib/live-leaderboard";

/** Leaderboard rows for the table. Disk/memory on the request path so the
 * Leaderboards tab is not blocked on a full upstream pull. */
export async function getLeaderboardWithLiveFinancials() {
  return getLeaderboardForApp({ waitMs: 0 });
}
