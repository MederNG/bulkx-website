import { Sparkles } from "lucide-react";
import { KpiTerminalCounter, type NumberFormat } from "@/components/cards/KpiTerminalCounter";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export function AlphaSection({ insights }: { insights: string[] }) {
  return (
    <div className="card card-highlight p-4 md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="section-title !text-accent">Alpha Insights</p>
      </div>
      <ul className="space-y-3">
        {insights.map((insight, i) => (
          <li key={i} className="flex gap-3 text-sm text-text-secondary">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            {insight}
          </li>
        ))}
      </ul>
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

export function WhaleCard({
  top10Share,
  top100Share,
  top1000Share,
  gini,
}: {
  top10Share: number;
  top100Share: number;
  top1000Share: number;
  gini: number;
}) {
  const rows: { label: string; value: string; info?: string }[] = [
    { label: "Top 10 Share", value: `${top10Share.toFixed(1)}%` },
    { label: "Top 100 Share", value: `${top100Share.toFixed(1)}%` },
    { label: "Top 1000 Share", value: `${top1000Share.toFixed(1)}%` },
    {
      label: "Gini Coefficient",
      value: gini.toFixed(3),
      info: "Measures how unequally AURA is spread across all wallets. 0 means every wallet holds an equal amount of AURA; 1 means a single wallet holds nearly all of it. Higher values indicate AURA is concentrated in a few whales.",
    },
  ];

  return (
    <div className="card p-4 md:p-5">
      <p className="mb-4 text-sm font-medium">Whale Concentration</p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              {row.label}
              {row.info && <InfoTooltip text={row.info} />}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
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
    <div className="card p-4 md:p-5">
      <p className="mb-4 text-sm font-medium">Distribution Metrics</p>
      <div className="space-y-2">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{s.label}</span>
            <span className="font-mono tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
