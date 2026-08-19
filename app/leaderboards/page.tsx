import { LeaderboardTable } from "@/components/tables/LeaderboardTable";

export const revalidate = 60;

export default function LeaderboardsPage() {
  return (
    <div className="shell pb-11 pt-5">
      {/* The heading lives inside LeaderboardTable: the rank tabs sit in its
          card, and they need the state that decides which ranking is showing —
          state a server component cannot hold. Same arrangement as /tools. */}
      <LeaderboardTable />
    </div>
  );
}
