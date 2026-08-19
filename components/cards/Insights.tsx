import { KpiTerminalCounter, type NumberFormat } from "@/components/cards/KpiTerminalCounter";
import { CopyableWallet } from "@/components/ui/CopyableWallet";
import { PanelCard, PanelLabel } from "@/components/overview/PanelCard";
import { cn } from "@/lib/utils";
import type { AlphaInsight } from "@/types";

export function AlphaSection({ insights }: { insights: AlphaInsight[] }) {
  return (
    <div className="card card-highlight p-4 md:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className="group rounded border border-[rgba(198,182,186,0.12)] bg-bulk-base p-3.5"
          >
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">
              {insight.label}
            </p>
            <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-accent">
              {insight.value}
            </p>
            {insight.detail && (
              <div
                className={cn(
                  "mt-1 text-xs text-text-secondary",
                  insight.mono && "font-mono"
                )}
              >
                {insight.copyValue ? (
                  <CopyableWallet wallet={insight.copyValue} display={insight.detail} />
                ) : (
                  insight.detail
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NorthStarMetrics({
  tvl,
  top1Threshold,
  totalAura,
  walletCount,
}: {
  tvl: number;
  top1Threshold: number;
  totalAura: number;
  walletCount: number;
}) {
  const metrics: { label: string; value: number; format: NumberFormat }[] = [
    { label: "Current TVL", value: tvl, format: "usd-full" },
    { label: "Top 1% Threshold", value: top1Threshold, format: "plain" },
    { label: "Total Aura", value: totalAura, format: "plain" },
    { label: "Wallet Count", value: walletCount, format: "plain" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="card card-highlight p-5 text-center">
          <p className="section-title mb-2 text-accent">{m.label}</p>
          <KpiTerminalCounter
            value={m.value}
            format={m.format}
            className="block font-mono text-2xl font-bold tabular-nums md:text-3xl"
          />
        </div>
      ))}
    </div>
  );
}

export function DistributionStats({
  median,
  average,
  top10,
  top5,
  top1,
}: {
  median: number;
  average: number;
  top10: number;
  top5: number;
  top1: number;
}) {
  const stats = [
    { label: "Median Aura", value: median.toLocaleString() },
    { label: "Average Aura", value: Math.round(average).toLocaleString() },
    { label: "Top 10% Threshold", value: top10.toLocaleString() },
    { label: "Top 5% Threshold", value: top5.toLocaleString() },
    { label: "Top 1% Threshold", value: top1.toLocaleString() },
  ];

  return (
    <PanelCard glossy glossDelay={-3} className="h-full font-sans">
      <PanelLabel>Distribution Metrics</PanelLabel>
      <div className="mt-3 -mx-3 sm:-mx-5">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "group flex h-[30px] items-center justify-between px-3 text-[13px] leading-none transition-colors sm:px-5",
              i > 0 && "border-t border-[var(--color-line-soft)]",
              "hover:bg-[rgba(255,255,255,0.04)]"
            )}
          >
            <span className="text-text-secondary transition-colors group-hover:text-text-primary">
              {s.label}
            </span>
            <span className="tabular-nums text-text-primary">{s.value}</span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}
