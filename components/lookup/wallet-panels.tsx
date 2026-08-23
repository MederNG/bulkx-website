"use client";

import { useMemo, useState } from "react";
import type { WalletData } from "@/types";
import {
  AuraDonut,
  AURA_SOURCES_DONUT_WELL,
  donutApexInset,
} from "@/components/overview/AuraDonut";
import { PanelLabel } from "@/components/overview/PanelCard";
import { Select } from "@/components/ui/Select";
import { aggregateBySource } from "@/lib/aura-category-groups";
import { extractCampaignWeek } from "@/lib/wallet-aura-breakdown";
import {
  chartPrimaryRamp,
  type OverviewDonutSegment,
} from "@/lib/overview-metrics";
import { cn, formatNumber, formatUsd } from "@/lib/utils";
import { useNarrowViewport } from "@/lib/use-narrow-viewport";

export function weekBreakdown(categories: Record<string, number> | undefined) {
  const byWeek = new Map<number, number>();
  for (const [key, raw] of Object.entries(categories ?? {})) {
    const points = Number(raw) || 0;
    if (points <= 0) continue;
    const week = extractCampaignWeek(key);
    if (week == null) continue;
    byWeek.set(week, (byWeek.get(week) ?? 0) + points);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, points]) => ({ week, points }));
}

export function averageHeldAmount(data: WalletData): number {
  const usdHours =
    data.total_held_time_hours ??
    (data.total_held_time_seconds ? data.total_held_time_seconds / 3600 : 0);
  if (usdHours > 0 && data.hold_time_days > 0) {
    return usdHours / (data.hold_time_days * 24);
  }
  return data.current_amount > 0 ? data.current_amount : 0;
}

/**
 * Same Source Breakdown shell as the global view — AuraDonut + legend —
 * fed with this wallet's sources and a week filter instead of Overview groups.
 */
export function PersonalSourcesPanel({ data }: { data: WalletData }) {
  const [selectedWeek, setSelectedWeek] = useState<"all" | number>("all");
  const narrow = useNarrowViewport();
  const weeks = useMemo(() => weekBreakdown(data.categories), [data.categories]);

  const sources = useMemo(() => {
    const items = Object.entries(data.categories ?? {})
      .filter(([key, raw]) => {
        const points = Number(raw) || 0;
        if (points <= 0) return false;
        if (selectedWeek === "all") return true;
        return extractCampaignWeek(key) === selectedWeek;
      })
      .map(([key, points]) => ({
        key,
        category: key,
        points: Number(points) || 0,
        share: 0,
      }));
    return aggregateBySource(items)
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points);
  }, [data.categories, selectedWeek]);

  const totalAura = useMemo(
    () => sources.reduce((sum, row) => sum + row.points, 0),
    [sources]
  );

  const segments = useMemo<OverviewDonutSegment[]>(
    () =>
      sources.map((row, i) => ({
        id: row.key,
        label: row.category,
        color: chartPrimaryRamp(i, sources.length),
        pct: totalAura > 0 ? (row.points / totalAura) * 100 : 0,
        points: row.points,
      })),
    [sources, totalAura]
  );

  const weekOptions = useMemo(
    () => [
      { value: "all", label: "All weeks" },
      ...weeks.map((row) => ({
        value: String(row.week),
        label: `Week ${row.week}`,
      })),
    ],
    [weeks]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex min-h-8 shrink-0 items-center justify-between gap-3">
        <PanelLabel>Source Breakdown</PanelLabel>
        {weekOptions.length > 1 && (
          <Select
            value={selectedWeek === "all" ? "all" : String(selectedWeek)}
            onChange={(value) =>
              setSelectedWeek(value === "all" ? "all" : Number(value))
            }
            options={weekOptions}
            className="w-[9.5rem] shrink-0"
            compact
          />
        )}
      </div>
      {segments.length === 0 ? (
        <p className="font-data text-[13px] text-text-muted">
          {selectedWeek === "all"
            ? "No source breakdown."
            : `No Aura recorded for week ${selectedWeek}.`}
        </p>
      ) : (
        <div
          className="flex min-h-0 flex-1 items-start"
          style={narrow ? undefined : { minHeight: AURA_SOURCES_DONUT_WELL }}
        >
          <div className="flex h-full min-h-0 w-full min-w-0">
            <AuraDonut
              key={selectedWeek === "all" ? "all" : `w${selectedWeek}`}
              segments={segments}
              totalAuraNumber={totalAura}
              showShare={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AuraStatsPanel({ data }: { data: WalletData }) {
  const narrow = useNarrowViewport();
  const avgWeeks = data.hold_time_days > 0 ? data.hold_time_days / 7 : 0;
  const avgAmount = averageHeldAmount(data);

  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: "Total Aura", value: formatNumber(data.aura), accent: true },
    { label: "Aura rank", value: `#${data.aura_rank.toLocaleString("en-US")}` },
    { label: "Referrals", value: String(data.referrals_sent) },
    { label: "Qualified", value: String(data.referrals_qualified) },
    { label: "Peak deposit", value: formatUsd(data.deposited_amount) },
    { label: "Current deposit", value: formatUsd(data.current_amount) },
    {
      label: "Avg hold duration",
      value: avgWeeks > 0 ? `${avgWeeks.toFixed(1)} wks` : "—",
    },
    {
      label: "Avg held balance",
      value: avgAmount > 0 ? formatUsd(avgAmount) : "—",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex min-h-8 shrink-0 items-center">
        <PanelLabel>Aura Stats</PanelLabel>
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-6 gap-y-5"
        style={
          narrow
            ? undefined
            : {
                // Same inset as the donut legend, so Total Aura / Aura Rank
                // sit on CATEGORY / AURA and the ring apex.
                paddingTop: donutApexInset(AURA_SOURCES_DONUT_WELL),
              }
        }
      >
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="font-label m-0 text-text-muted">{stat.label}</p>
            <p
              className={cn(
                "mt-1 font-data text-[15px] font-medium tabular-nums",
                stat.accent ? "text-accent" : "text-text-primary"
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
