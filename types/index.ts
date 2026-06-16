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
  categoryBreakdown: { category: string; points: number; share: number }[];
  topReferrers: LeaderboardEntry[];
  referralCandidates: LeaderboardEntry[];
  topEfficiency: (LeaderboardEntry & { efficiency: number })[];
  alphaInsights: string[];
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
