"use client";

import { useEffect, useState } from "react";
import { useLiveFinancials } from "@/components/live/LiveFinancialProvider";
import { useLiveExchange } from "@/components/live/LiveExchangeProvider";
import { cn } from "@/lib/utils";

const WEEK_DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const MS_DAY = 86_400_000;

function formatTps(value: number | null): string {
  if (value == null) return "—";
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatLeftCompact(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  return `${days}d ${hours}h left`;
}

function WeekTicks({ today }: { today: number | null }) {
  return (
    <div className="flex items-center gap-[2px]" aria-hidden>
      {WEEK_DAYS.map((day, i) => {
        const current = today != null && i === today;
        const past = today != null && i < today;
        return (
          <div
            key={day}
            title={day}
            className={cn("h-[9px] w-[7px]", current && "apr-week-pulse")}
            style={{
              background: current ? "#ffb547" : past ? "#6b8cae" : "rgba(255,255,255,.09)",
            }}
          />
        );
      })}
    </div>
  );
}

export function HeaderCampaignStatus() {
  const live = useLiveFinancials();
  const exchange = useLiveExchange();
  const nextSnapshot = live.depositPredict.nextSnapshotTimestamp;
  const [today, setToday] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const start = nextSnapshot - 7 * MS_DAY;
      const index = Math.floor((Date.now() - start) / MS_DAY);
      setToday(Math.min(6, Math.max(0, index)));
      setRemainingMs(Math.max(0, nextSnapshot - Date.now()));
    };
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [nextSnapshot]);

  const week = live.depositPredict.campaignWeek;
  const left = remainingMs != null ? formatLeftCompact(remainingMs) : "—";

  return (
    <div className="hidden items-center gap-[18px] lg:flex">
      <span className="flex items-baseline gap-[7px]">
        <span className="font-label text-text-muted">TPS</span>
        <span className="font-data text-[12px] text-text-secondary">{formatTps(exchange.tps)}</span>
      </span>
      <span className="h-[18px] w-px bg-[var(--color-line-strong)]" aria-hidden />
      <span
        className="flex items-center gap-[9px]"
        title={`Week ${week} · ${left}`}
      >
        <span className="font-label text-text-muted">W{week}</span>
        <WeekTicks today={today} />
        <span className="font-data whitespace-nowrap text-[11px] text-text-muted">{left}</span>
      </span>
    </div>
  );
}
