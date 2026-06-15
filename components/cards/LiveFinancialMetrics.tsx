"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { MetricCard } from "@/components/cards/MetricCard";

export interface LiveFinancials {
  currentTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  depositWallets: number;
  updatedAt: string;
}

const FinancialMetricsContext = createContext<LiveFinancials | null>(null);

function useFinancialMetrics(): LiveFinancials {
  const ctx = useContext(FinancialMetricsContext);
  if (!ctx) {
    throw new Error("useFinancialMetrics must be used within FinancialMetricsProvider");
  }
  return ctx;
}

export function FinancialMetricsProvider({
  initial,
  children,
}: {
  initial: LiveFinancials;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/totals", { cache: "no-store" });
      if (!res.ok) return;
      const totals = await res.json() as {
        tvl?: number;
        totalDeposited?: number;
        totalWithdrawn?: number;
        totalWallets?: number;
        updatedAt?: string;
      };
      if (!totals.tvl && !totals.totalDeposited) return;
      setData((prev) => ({
        currentTvl: totals.tvl ?? prev.currentTvl,
        totalDeposited: totals.totalDeposited ?? prev.totalDeposited,
        totalWithdrawn: totals.totalWithdrawn ?? prev.totalWithdrawn,
        depositWallets: totals.totalWallets ?? prev.depositWallets,
        updatedAt: totals.updatedAt ?? prev.updatedAt,
      }));
    } catch {
      // Keep showing the last known values.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    const onRefresh = () => refresh();
    window.addEventListener("aura:data-refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("aura:data-refresh", onRefresh);
    };
  }, [refresh]);

  return (
    <FinancialMetricsContext.Provider value={data}>{children}</FinancialMetricsContext.Provider>
  );
}

export function HeroTvlCard() {
  const { currentTvl } = useFinancialMetrics();
  return <MetricCard label="Current TVL" value={currentTvl} format="usd-full" />;
}

export function TvlSectionCards() {
  const { currentTvl, totalDeposited, totalWithdrawn } = useFinancialMetrics();
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricCard label="Current TVL" value={currentTvl} format="usd-full" />
      <MetricCard label="Total Deposited" value={totalDeposited} format="usd-full" />
      <MetricCard label="Total Withdrawn" value={totalWithdrawn} format="usd-full" />
    </div>
  );
}

export function LiveTvlInsight() {
  const { currentTvl, depositWallets } = useFinancialMetrics();
  return (
    <li className="flex gap-3 text-sm text-text-secondary">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
      {`Current TVL: $${Math.round(currentTvl).toLocaleString()} across ${depositWallets.toLocaleString()} depositors.`}
    </li>
  );
}

export function LiveLastUpdated({ fallback }: { fallback: string }) {
  const { updatedAt } = useFinancialMetrics();
  const stamp = updatedAt || fallback;
  return <>Last updated {new Date(stamp).toLocaleString()} · Live TVL from API</>;
}
