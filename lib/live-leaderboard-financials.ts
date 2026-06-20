import { getLiveLeaderboardFresh } from "@/lib/live-leaderboard";

/** Leaderboard rows synced from upstream (aura + deposits). */
export async function getLeaderboardWithLiveFinancials() {
  return getLiveLeaderboardFresh();
}
