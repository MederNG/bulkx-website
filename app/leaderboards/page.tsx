import { LeaderboardTable } from "@/components/tables/LeaderboardTable";
import { getSortedLeaderboard } from "@/lib/stats";

export const dynamic = "force-static";
export const revalidate = 60;

export default function LeaderboardsPage() {
  const initialRows = getSortedLeaderboard("aura");

  return (
    <div className="shell flex flex-col gap-4 pb-11 pt-5">
      {/* The heading lives inside LeaderboardTable: the rank tabs sit in its
          card, and they need the state that decides which ranking is showing —
          state a server component cannot hold. Same arrangement as /tools.
          First paint ships the Aura ranking so the tab is not an empty
          spinner waiting on /api/leaderboard. */}
      <LeaderboardTable initialRows={initialRows} />
    </div>
  );
}
