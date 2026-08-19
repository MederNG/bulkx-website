import { CalculatorSection } from "@/components/calculator/Calculators";
import { computeDashboardMetrics } from "@/lib/stats";

export const revalidate = 60;

export default async function ToolsPage() {
  const metrics = await computeDashboardMetrics();

  return (
    <div className="shell pb-11 pt-5">
      {/* The heading now lives inside CalculatorSection: the tool tabs sit in
          its card, and they need the state that decides which tool is showing
          — state a server component cannot hold. */}
      <CalculatorSection totalAuraSupply={metrics.totalAura} />
    </div>
  );
}
