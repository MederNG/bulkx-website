import { KpiTerminalCounter, type NumberFormat } from "@/components/cards/KpiTerminalCounter";
import { CopyableWallet } from "@/components/ui/CopyableWallet";
import { PanelCard, PanelLabel } from "@/components/overview/PanelCard";
import { cn } from "@/lib/utils";
import type { AlphaInsight } from "@/types";

export function AlphaSection({ insights }: { insights: AlphaInsight[] }) {
  return (
    <PanelCard glossy glossDelay={-3}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {insights.map((insight) => (
          <div key={insight.label} className="min-w-0">
            <p className="font-label text-text-muted">{insight.label}</p>
            <p className="mt-1.5 font-data text-sm font-semibold text-accent">
              {insight.value}
            </p>
            {insight.detail && (
              <div
                className={cn(
                  "mt-1 text-xs text-text-secondary",
                  insight.mono && "font-data"
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
    </PanelCard>
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
        <PanelCard key={m.label} className="text-center">
          <PanelLabel>{m.label}</PanelLabel>
          <KpiTerminalCounter
            value={m.value}
            format={m.format}
            className="font-figure mt-2 block text-2xl md:text-3xl"
          />
        </PanelCard>
      ))}
    </div>
  );
}
