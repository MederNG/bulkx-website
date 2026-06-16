import { MetricCard, type SecondaryMetric } from "@/components/cards/MetricCard";
import { KpiTerminalCounter } from "@/components/cards/KpiTerminalCounter";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  formatRemainingDuration,
  formatSignedPercent,
  formatSignedUsd,
  formatSnapshotUtc,
  type ProjectedSnapshotTvl,
} from "@/lib/projected-snapshot-tvl";
import type { TvlKpiSecondaryMetrics } from "@/lib/tvl-kpi-secondary";
import { cn, formatPercent, formatUsd } from "@/lib/utils";

export interface FinancialMetrics {
  currentTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  depositWallets: number;
  updatedAt: string;
}

export function HeroTvlCard({ currentTvl }: Pick<FinancialMetrics, "currentTvl">) {
  return <MetricCard label="Current TVL" value={currentTvl} format="usd-full" />;
}

function signedValueClass(value: number | null): string | undefined {
  if (value == null) return "text-text-secondary";
  return value >= 0 ? "text-bid-green" : "text-ask-red";
}

function buildTvlSecondaryMetrics(metrics: TvlKpiSecondaryMetrics): SecondaryMetric[] {
  return [
    {
      label: "24H Net Flow",
      value: metrics.netFlow24h != null ? formatSignedUsd(metrics.netFlow24h) : "—",
      valueClassName: signedValueClass(metrics.netFlow24h),
    },
    {
      label: "7D Growth",
      value: metrics.growth7dPct != null ? formatSignedPercent(metrics.growth7dPct) : "—",
      valueClassName: signedValueClass(metrics.growth7dPct),
    },
  ];
}

function buildDepositedSecondaryMetrics(metrics: TvlKpiSecondaryMetrics): SecondaryMetric[] {
  return [
    {
      label: "24H Deposits",
      value: metrics.deposits24h != null ? formatUsd(metrics.deposits24h) : "—",
    },
    {
      label: "Avg Daily Deposits",
      value: metrics.avgDailyDeposits != null ? formatUsd(metrics.avgDailyDeposits) : "—",
    },
  ];
}

function buildWithdrawnSecondaryMetrics(metrics: TvlKpiSecondaryMetrics): SecondaryMetric[] {
  return [
    {
      label: "24H Withdrawals",
      value: metrics.withdrawals24h != null ? formatUsd(metrics.withdrawals24h) : "—",
    },
    {
      label: "Withdrawal Rate",
      value:
        metrics.withdrawalRatePct != null
          ? formatPercent(metrics.withdrawalRatePct)
          : "—",
    },
  ];
}

function ProjectedTvlCard({ projection }: { projection: Extract<ProjectedSnapshotTvl, { available: true }> }) {
  return (
    <div className="card card-highlight metric-card flex h-full min-h-[172px] flex-col border border-[rgba(255,181,71,0.45)] p-4 text-center md:min-h-[188px] md:p-5">
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <p className="section-title !text-accent">Projected TVL</p>
        <InfoTooltip
          floating
          text="Estimated TVL at the next weekly AURA snapshot (Saturday 13:00 UTC), based on weighted 7-day TVL growth."
        />
      </div>
      <KpiTerminalCounter
        value={projection.projectedTvl}
        format="usd-full"
        className="block font-mono text-xl font-semibold tabular-nums text-text-primary md:text-2xl"
      />
      <p className="mt-2 text-xs text-text-secondary">
        Snapshot: {formatSnapshotUtc(projection.nextSnapshotTimestamp)}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        Expected Growth:{" "}
        <span className="font-mono tabular-nums text-bid-green">
          {formatSignedUsd(projection.expectedGrowth, true)} ({formatSignedPercent(projection.expectedGrowthPercent)})
        </span>
      </p>
      <div className="flex-1" aria-hidden="true" />
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[rgba(198,182,186,0.12)] pt-3 text-left">
        <div>
          <div className="flex items-center gap-1">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">Weighted Daily Flow</p>
            <InfoTooltip text="Recent days receive higher weighting than older days." />
          </div>
          <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-bid-green md:text-[13px]">
            {formatSignedUsd(projection.weightedDailyFlow)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-secondary">Days Remaining</p>
          <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-text-primary md:text-[13px]">
            {formatRemainingDuration(projection.remainingMs)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TvlSectionCards({
  currentTvl,
  totalDeposited,
  totalWithdrawn,
  projection,
  secondaryMetrics,
}: Pick<FinancialMetrics, "currentTvl" | "totalDeposited" | "totalWithdrawn"> & {
  projection: ProjectedSnapshotTvl;
  secondaryMetrics?: TvlKpiSecondaryMetrics;
}) {
  const tvlSecondary = secondaryMetrics ? buildTvlSecondaryMetrics(secondaryMetrics) : undefined;
  const depositedSecondary = secondaryMetrics
    ? buildDepositedSecondaryMetrics(secondaryMetrics)
    : undefined;
  const withdrawnSecondary = secondaryMetrics
    ? buildWithdrawnSecondaryMetrics(secondaryMetrics)
    : undefined;

  return (
    <>
      <div
        className={cn(
          "mb-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2",
          projection.available ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        <MetricCard
          label="Current TVL"
          value={currentTvl}
          format="usd-full"
          secondaryMetrics={tvlSecondary}
        />
        <MetricCard
          label="Total Deposited"
          value={totalDeposited}
          format="usd-full"
          secondaryMetrics={depositedSecondary}
        />
        <MetricCard
          label="Total Withdrawn"
          value={totalWithdrawn}
          format="usd-full"
          secondaryMetrics={withdrawnSecondary}
        />
        {projection.available && <ProjectedTvlCard projection={projection} />}
      </div>
      {!projection.available && (
        <p className="mb-4 text-sm text-text-secondary">
          Projection unavailable — insufficient historical data.
        </p>
      )}
    </>
  );
}

export function LiveTvlInsight({
  currentTvl,
  depositWallets,
}: Pick<FinancialMetrics, "currentTvl" | "depositWallets">) {
  return (
    <li className="flex gap-3 text-sm text-text-secondary">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
      {`Current TVL: $${Math.round(currentTvl).toLocaleString()} across ${depositWallets.toLocaleString()} depositors.`}
    </li>
  );
}

export function LiveLastUpdated({ updatedAt }: Pick<FinancialMetrics, "updatedAt">) {
  return <>Last updated {new Date(updatedAt).toLocaleString()} · Live TVL from API</>;
}
