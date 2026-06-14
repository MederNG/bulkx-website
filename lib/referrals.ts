import type { LeaderboardEntry } from "@/types";

export function hasReferralActivity(entry: LeaderboardEntry): boolean {
  return (
    (entry.referral_number ?? 0) > 0 ||
    entry.referrals_sent > 0 ||
    entry.referrals_qualified > 0
  );
}
