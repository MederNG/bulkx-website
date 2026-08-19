import { CategoryCharts, AuraHistogram } from "@/components/charts/Charts";
import { DistributionStats } from "@/components/cards/Insights";
import { computeDashboardMetrics } from "@/lib/stats";

export const revalidate = 60;

export default async function AuraSourcesPage() {
  const metrics = await computeDashboardMetrics();

  return (
    <div className="shell flex flex-col gap-4 pb-11 pt-5">
      {/* The heading lives inside CategoryCharts: same arrangement as /tools
          and /leaderboards, so the watermark card and the two panels below it
          share one column gap. */}
      <CategoryCharts data={metrics.categoryBreakdown} />
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
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
    </div>
  );
}
