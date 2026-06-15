import { MetricCard } from "@/components/cards/MetricCard";

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

export function TvlSectionCards({
  currentTvl,
  totalDeposited,
  totalWithdrawn,
}: Pick<FinancialMetrics, "currentTvl" | "totalDeposited" | "totalWithdrawn">) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricCard label="Current TVL" value={currentTvl} format="usd-full" />
      <MetricCard label="Total Deposited" value={totalDeposited} format="usd-full" />
      <MetricCard label="Total Withdrawn" value={totalWithdrawn} format="usd-full" />
    </div>
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
