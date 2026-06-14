import { ArrowUpRight } from "lucide-react";
import { computeDashboardMetrics, getChartSnapshots, getRankTargetsFromData } from "@/lib/stats";
import { getLeaderboard } from "@/lib/fetcher";
import { MetricCard, Section } from "@/components/cards/MetricCard";
import {
  AlphaSection,
  DistributionStats,
  WhaleCard,
} from "@/components/cards/Insights";
import { ShareCardGenerator } from "@/components/cards/ShareCard";
import {
  AuraHistogram,
  CategoryCharts,
  LorenzChart,
  TvlChart,
} from "@/components/charts/Charts";
import {
  FdvTools,
  RankCalculator,
} from "@/components/calculator/Calculators";
import { WalletLookup } from "@/components/lookup/WalletLookup";
import {
  EfficiencyTable,
  LeaderboardTable,
  ReferralTable,
} from "@/components/tables/LeaderboardTable";
export const revalidate = 300;

export default function HomePage() {
  const metrics = computeDashboardMetrics();
  const snapshots = getChartSnapshots("ALL");
  const targets = getRankTargetsFromData();
  const leaderboard = getLeaderboard().slice(0, 100);

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6">
      {/* Hero */}
      <section className="border-b border-[rgba(198,182,186,0.1)] py-10 md:py-14">
        <p className="section-title mb-3 text-accent">AURA Analytics Terminal</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Intelligence</h1>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary md:text-base">
          Real-time analytics for the BULK AURA campaign. Institutional-grade insights
          beyond the official interface.
        </p>
        <a
          href="https://early.bulk.trade/deposit?ref=maker"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6 inline-flex items-center gap-2"
        >
          Deposit
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Total Wallets" value={metrics.totalWallets} format="plain" />
          <MetricCard label="Current TVL" value={metrics.currentTvl} format="usd-full" />
          <MetricCard label="Total Aura" value={metrics.totalAura} format="plain" />
        </div>
      </section>

      {/* Wallet Lookup - above fold on mobile */}
      <Section id="lookup" title="Wallet Lookup" subtitle="Search any wallet for detailed Aura analytics">
        <WalletLookup />
      </Section>

      {/* Alpha */}
      <Section title="Market Intelligence">
        <AlphaSection insights={metrics.alphaInsights} />
      </Section>

      {/* TVL Analytics */}
      <Section title="TVL Analytics" subtitle="Historical total value locked">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Current TVL" value={metrics.currentTvl} format="usd-full" />
          <MetricCard label="Total Deposited" value={metrics.totalDeposited} format="usd-full" />
          <MetricCard label="Total Withdrawn" value={metrics.totalWithdrawn} format="usd-full" />
        </div>
        <TvlChart data={snapshots} />
      </Section>

      {/* Aura Distribution */}
      <Section title="Aura Distribution">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AuraHistogram data={metrics.auraDistribution} />
          </div>
          <DistributionStats
            median={metrics.medianAura}
            average={metrics.averageAura}
            top10={metrics.top10Threshold}
            top5={metrics.top5Threshold}
            top1={metrics.top1Threshold}
          />
        </div>
      </Section>

      {/* Whale Analytics */}
      <Section title="Whale Analytics">
        <div className="grid gap-4 lg:grid-cols-2">
          <WhaleCard
            top10Share={metrics.top10Share}
            top100Share={metrics.top100Share}
            top1000Share={metrics.top1000Share}
            gini={metrics.giniCoefficient}
          />
          <LorenzChart data={metrics.lorenzCurve} />
        </div>
      </Section>

      {/* Aura Source Breakdown */}
      <Section title="Aura Source Breakdown">
        <CategoryCharts data={metrics.categoryBreakdown} />
      </Section>

      {/* Referral Analytics */}
      <Section title="Referral Analytics" subtitle="Top-10 referrers">
        <ReferralTable data={metrics.referralCandidates} />
      </Section>

      {/* Efficiency Analytics */}
      <Section title="Efficiency Analytics" subtitle="Deposit Aura earned per dollar deposited">
        <EfficiencyTable data={metrics.topEfficiency} />
      </Section>

      {/* Calculators */}
      <Section id="calculator" title="Tools">
        <div className="grid gap-4 lg:grid-cols-2">
          <RankCalculator targets={targets} />
          <FdvTools totalAuraSupply={metrics.totalAura} />
        </div>
      </Section>

      {/* Leaderboards */}
      <Section id="leaderboards" title="Leaderboards" subtitle="Top 100 wallets across ranking dimensions">
        <LeaderboardTable initialData={leaderboard} />
      </Section>

      {/* Share Card */}
      <Section title="Share Card">
        <ShareCardGenerator />
      </Section>

      <div className="pb-12 pt-4 text-center text-[10px] text-text-secondary">
        Last updated {new Date(metrics.lastUpdated).toLocaleString()} · Auto-refreshed hourly from snapshot
        <div className="mt-1">Not affiliated with BULK.</div>
      </div>
    </div>
  );
}
