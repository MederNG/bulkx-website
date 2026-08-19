import type { WalletAuraBreakdown } from "@/lib/wallet-aura-breakdown";

export interface LeaderboardEntry {
  wallet: string;
  aura: number;
  aura_rank: number;
  deposit_rank: number;
  deposited_amount: number;
  withdrawn_amount: number;
  current_amount: number;
  referrals_sent: number;
  referrals_qualified: number;
  referrals_rewarded: number;
  referees_total_deposited?: number;
  categories: Record<string, number>;
  first_seen?: string;
  total_held_time_seconds?: number;
  total_held_time_hours?: number;
  referral_number?: number;
  updated_at?: string;
}

export interface AlphaInsight {
  label: string;
  value: string;
  detail?: string;
  mono?: boolean;
  /** Full wallet address to copy, when `detail` shows a truncated one. */
  copyValue?: string;
}

export interface LeaderboardResponse {
  items: LeaderboardEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface WalletData extends LeaderboardEntry {
  percentile: number;
  hold_time_days: number;
  efficiency: number;
  aura_breakdown: WalletAuraBreakdown;
}

export interface Snapshot {
  timestamp: string;
  tvl: number;
  totalAura: number;
  wallets: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
}

export interface Totals {
  tvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWallets: number;
  leaderboardWallets?: number;
  updatedAt: string;
}

export interface DashboardMetrics {
  totalWallets: number;
  depositWallets: number;
  currentTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalAura: number;
  qualifiedReferrals: number;
  /** Depositor count and USD still held per deposit-size bucket, smallest to
   * largest.
   *
   * Which bucket a wallet lands in is decided by `deposited_amount` — that is
   * what a tier like "$100-1K" names. `held` is a different question and sums
   * deposits net of withdrawals, so the buckets add up to TVL rather than to
   * lifetime deposits. Summing `deposited_amount` instead put $88.8M against
   * a TVL of $22.5M: the withdrawn $65M counted as though it were still
   * there. */
  depositSizeDistribution: { bucket: string; count: number; held: number }[];
  /**
   * "OG Hodlers": earned Aura in week 1 (categories.week1 > 0 — the campaign's
   * `first_seen` field is never populated, so this is the only real signal
   * for early participation) and have never withdrawn since.
   */
  ogHodlers: number;
  medianAura: number;
  averageAura: number;
  top10Threshold: number;
  top5Threshold: number;
  top1Threshold: number;
  top10Share: number;
  top100Share: number;
  top1000Share: number;
  giniCoefficient: number;
  lorenzCurve: { cumulativeWallets: number; cumulativeAura: number }[];
  auraDistribution: { bucket: string; count: number }[];
  categoryBreakdown: { key: string; category: string; points: number; share: number }[];
  topReferrers: LeaderboardEntry[];
  referralCandidates: LeaderboardEntry[];
  topEfficiency: (LeaderboardEntry & { efficiency: number })[];
  alphaInsights: AlphaInsight[];
  lastUpdated: string;
}

export interface RankTargets {
  top10Percent: number;
  top5Percent: number;
  top1Percent: number;
  top100: number;
  top50: number;
  top10: number;
}

export interface FdvResult {
  poolValue: number;
  auraValue: number;
  userValue: number;
}

export type LeaderboardTab = "aura" | "deposit" | "efficiency" | "referral";

export type ChartRange = "24H" | "7D" | "30D" | "ALL";
