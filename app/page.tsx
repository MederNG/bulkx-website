import { ArrowUpRight } from "lucide-react";
import { computeDashboardMetrics, getChartSnapshots, getRankTargetsFromData } from "@/lib/stats";
import { MetricCard, Section } from "@/components/cards/MetricCard";
import {
  HeroTvlCard,
  LiveLastUpdated,
  LiveTvlInsight,
  TvlSectionCards,
} from "@/components/cards/LiveFinancialMetrics";
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
  LeaderboardTable,
} from "@/components/tables/LeaderboardTable";

export const revalidate = 300;

export default async function HomePage() {
  const metrics = await computeDashboardMetrics();
  const snapshots = getChartSnapshots("ALL");
  const targets = getRankTargetsFromData();
  const staticInsights = metrics.alphaInsights.slice(0, -1);

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        {/* Hero */}
        <section className="border-b border-[rgba(198,182,186,0.1)] py-10 md:py-14">
          <p className="section-title mb-3 text-accent">AURA Analytics Terminal</p>
          <h1 className="hero-intelligence-title text-3xl md:text-5xl">INTELLIGENCE</h1>
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
            <HeroTvlCard currentTvl={metrics.currentTvl} />
            <MetricCard label="Total Aura" value={metrics.totalAura} format="plain" />
          </div>
        </section>

        {/* Wallet Lookup - above fold on mobile */}
        <Section id="lookup" title="Wallet Lookup" subtitle="Search any wallet for detailed Aura analytics">
          <WalletLookup />
        </Section>

        {/* Alpha */}
        <Section title="Market Intelligence">
          <AlphaSection insights={staticInsights}>
            <LiveTvlInsight
              currentTvl={metrics.currentTvl}
              depositWallets={metrics.depositWallets}
            />
          </AlphaSection>
        </Section>

        {/* TVL Analytics */}
        <Section title="TVL Analytics" subtitle="Historical total value locked">
          <TvlSectionCards
            currentTvl={metrics.currentTvl}
            totalDeposited={metrics.totalDeposited}
            totalWithdrawn={metrics.totalWithdrawn}
          />
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

        {/* Source Breakdown */}
        <Section title="Aura Source Breakdown">
          <CategoryCharts data={metrics.categoryBreakdown} />
        </Section>

        {/* Tools */}
        <Section id="calculator" title="Tools">
          <div className="grid gap-4 lg:grid-cols-2">
            <RankCalculator targets={targets} />
            <FdvTools totalAuraSupply={metrics.totalAura} />
          </div>
        </Section>

        {/* Leaderboards */}
        <Section id="leaderboards" title="Leaderboards" subtitle="Top 100 wallets per ranking category">
          <LeaderboardTable />
        </Section>

        {/* Share Card */}
        <Section title="Share Card">
          <ShareCardGenerator />
        </Section>

        <div className="pb-12 pt-4 text-center text-[10px] text-text-secondary">
          <LiveLastUpdated updatedAt={metrics.lastUpdated} />
          <div className="mt-1">Not affiliated with BULK.</div>
        </div>
      </div>
  );
}
