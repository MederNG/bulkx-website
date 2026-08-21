"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  ComposedChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RectangleProps } from "recharts";
import type { ChartRange } from "@/types";
import type { ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import {
  formatSignedUsd,
  formatSnapshotUtc,
  formatSnapshotUtcParts,
  formatUsdCompact,
} from "@/lib/projected-snapshot-tvl";
import { CHART_GOLD_PULSE, CHART_GOLD_PULSE_TRANSITION, CHART_GOLD_PULSE_UNDERLAY } from "@/lib/chart-gold-pulse";
import { cn, formatNumber } from "@/lib/utils";
import { useNarrowViewport } from "@/lib/use-narrow-viewport";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Select } from "@/components/ui/Select";
import { PageHeading } from "@/components/layout/PageHeading";
import { PanelCard, PanelLabel } from "@/components/overview/PanelCard";
import {
  AURA_SOURCES_DONUT_WELL,
  donutApexInset,
  AuraDonut,
} from "@/components/overview/AuraDonut";
import { CATEGORY_NAME_SVG } from "@/components/overview/MetricTable";
import { chartPrimaryRamp, chartSlateRamp, CHART_GOLD, type OverviewDonutSegment } from "@/lib/overview-metrics";
import {
  OVERVIEW_GROUP,
  buildCategoryGroupOptions,
  filterCategoryBreakdown,
  type CategoryBreakdownItem,
} from "@/lib/aura-category-groups";

function useInViewOnce<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (hasEntered) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasEntered, threshold]);

  return { ref, hasEntered };
}

interface TvlChartPoint {
  timestamp: string;
  tvl?: number | null;
  projectedTvl?: number | null;
  isProjectionEndpoint?: boolean;
  /** Live TVL anchor where historical line meets the projection. */
  isCurrentTvl?: boolean;
}

interface TvlChartProps {
  data: { timestamp: string; tvl: number; totalAura: number }[];
  currentTvl: number;
  projection: ProjectedSnapshotTvl;
  referenceTimeMs: number;
}

function buildTvlChartData(
  historical: { timestamp: string; tvl: number; totalAura: number }[],
  currentTvl: number,
  projection: ProjectedSnapshotTvl,
  referenceTimeMs: number
): TvlChartPoint[] {
  const points: TvlChartPoint[] = historical.map((d) => ({
    timestamp: d.timestamp,
    tvl: d.tvl,
    projectedTvl: null,
  }));

  if (!projection.available) {
    return points;
  }

  const nowIso = new Date(referenceTimeMs).toISOString();
  const lastHistorical = points[points.length - 1];
  const bridgeTvl = currentTvl;

  if (!lastHistorical || new Date(lastHistorical.timestamp).getTime() < referenceTimeMs - 60_000) {
    points.push({ timestamp: nowIso, tvl: bridgeTvl, projectedTvl: bridgeTvl, isCurrentTvl: true });
  } else {
    lastHistorical.tvl = bridgeTvl;
    lastHistorical.projectedTvl = bridgeTvl;
    lastHistorical.isCurrentTvl = true;
  }

  const bridge = points[points.length - 1];
  if (bridge) {
    bridge.projectedTvl = bridgeTvl;
    bridge.isCurrentTvl = true;
  }

  points.push({
    timestamp: new Date(projection.nextSnapshotTimestamp).toISOString(),
    tvl: null,
    projectedTvl: projection.projectedTvl,
    isProjectionEndpoint: true,
  });

  return points;
}

function TvlChartTooltip({
  active,
  payload,
  label,
  projection,
}: {
  active?: boolean;
  payload?: { payload?: TvlChartPoint }[];
  label?: string;
  projection: ProjectedSnapshotTvl;
}) {
  if (!active || !payload?.length || !label) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  if (point.isProjectionEndpoint && projection.available) {
    const snapshotParts = formatSnapshotUtcParts(projection.nextSnapshotTimestamp);
    return (
      <div
        className="rounded border border-[rgba(198,182,186,0.2)] px-3 py-2 text-xs"
        style={{ background: "#1B1A14" }}
      >
        <p className="font-label text-accent">Projected TVL</p>
        <p className="mt-1 font-data text-text-primary">
          {formatUsdCompact(projection.projectedTvl)}
        </p>
        <p className="mt-2 font-label text-text-muted">Weighted Daily Flow</p>
        <p className="mt-0.5 font-data text-bid-green">
          {formatSignedUsd(projection.weightedDailyFlow, true)}/day
        </p>
        <p className="mt-2 font-label text-text-muted">Snapshot</p>
        <p className="mt-0.5 font-data text-text-primary">{snapshotParts.date}</p>
        <p className="font-data text-text-primary">{snapshotParts.time}</p>
        <p className="mt-2 font-label text-text-muted">Expected Growth</p>
        <p className="mt-0.5 font-data text-bid-green">
          {formatSignedUsd(projection.expectedGrowth, true)}
        </p>
      </div>
    );
  }

  const tvl = point.tvl ?? point.projectedTvl;
  if (tvl == null) return null;

  return (
    <div
      className="rounded border border-[rgba(198,182,186,0.2)] px-3 py-2 text-xs"
      style={{ background: "#1B1A14" }}
    >
      <p className="font-label text-text-muted">
        {new Date(label).toLocaleString("en-US", { timeZone: "UTC" })} UTC
      </p>
      <p className="mt-1 font-data text-text-primary">${tvl.toLocaleString("en-US")}</p>
    </div>
  );
}

function CurrentTvlBeaconDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: TvlChartPoint;
}) {
  if (cx == null || cy == null || !payload?.isCurrentTvl) return null;

  const label = formatUsdCompact(payload.tvl ?? 0);

  return (
    <g aria-label={`Current TVL ${label}`}>
      <circle cx={cx} cy={cy} r={14} fill="#FFB547" opacity={0.18}>
        <animate attributeName="r" values="9;16;9" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.32;0.08;0.32" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={5} fill="#FFB547" stroke="#141310" strokeWidth={2} />
    </g>
  );
}

export function TvlChart({ data, currentTvl, projection, referenceTimeMs }: TvlChartProps) {
  const [range, setRange] = useState<ChartRange>("7D");
  const ranges: ChartRange[] = ["7D", "30D", "ALL"];
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  const filtered = filterByRange(data, range, referenceTimeMs);
  const chartData = useMemo(
    () => buildTvlChartData(filtered, currentTvl, projection, referenceTimeMs),
    [filtered, currentTvl, projection, referenceTimeMs]
  );

  return (
    <PanelCard glossy glossDelay={-6} className="h-full">
      <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PanelLabel>TVL History &amp; Projection</PanelLabel>
          <InfoTooltip
            floating
            text="Historical TVL from hourly snapshots. The dashed line projects TVL to the next weekly snapshot using weighted 7-day TVL growth."
          />
        </div>
        <div className="term-seg">
          {ranges.map((r) => {
            const on = r === range;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={on}
                className={cn("term-seg-btn", on ? "is-on" : "is-off")}
              >
                {on && (
                  <motion.span
                    layoutId="legacy-tvl-range-pill"
                    className="term-seg-pill"
                    transition={{ type: "spring", stiffness: 480, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            );
          })}
        </div>
      </div>

      {projection.available && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-[#FFB547]" />
            <span className="relative inline-flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFB547] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFB547]" />
            </span>
            Historical TVL
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-[#FFB547]"
              style={{ opacity: 0.5 }}
            />
            Projection
          </span>
          <span className="ml-auto hidden text-text-secondary md:inline">
            Snapshot: {formatSnapshotUtc(projection.nextSnapshotTimestamp)}
          </span>
        </div>
      )}

      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart key={hasEntered ? "tvl-animate" : "tvl-idle"} data={chartData}>
            <defs>
              <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFB547" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FFB547" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
              }
              minTickGap={30}
            />
            <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={60} domain={["auto", "auto"]} />
            <Tooltip
              content={(props) => (
                <TvlChartTooltip
                  active={props.active}
                  payload={props.payload as { payload?: TvlChartPoint }[] | undefined}
                  label={props.label as string | undefined}
                  projection={projection}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="#FFB547"
              fill="url(#tvlGrad)"
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={hasEntered}
              dot={(props) => (
                <CurrentTvlBeaconDot
                  key={props.key ?? `tvl-dot-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  payload={props.payload as TvlChartPoint | undefined}
                />
              )}
              activeDot={false}
            />
            {projection.available && (
              <Line
                type="linear"
                dataKey="projectedTvl"
                stroke="#FFB547"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                dot={false}
                connectNulls
                isAnimationActive={hasEntered}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
    </PanelCard>
  );
}

function filterByRange(
  data: { timestamp: string; tvl: number; totalAura: number }[],
  range: ChartRange,
  referenceTimeMs: number
) {
  if (range === "ALL") return data;
  const ms =
    range === "24H" ? 86400000 : range === "7D" ? 7 * 86400000 : 30 * 86400000;
  return data.filter((d) => referenceTimeMs - new Date(d.timestamp).getTime() <= ms);
}

interface HistogramProps {
  data: { bucket: string; count: number }[];
}

function shortAuraBucket(label: string): string {
  return label
    .replace("1000-2500", "1k–2.5k")
    .replace("2500-5000", "2.5k–5k")
    .replace("500-1000", "0.5–1k")
    .replace("5000+", "5k+");
}

function CategoryYTick({
  x,
  y,
  payload,
  active,
  dimmed,
  onHover,
  onLeave,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  active?: boolean;
  dimmed?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
}) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill={
        active
          ? CHART_GOLD
          : dimmed
            ? "var(--color-text-muted)"
            : "var(--color-text-primary)"
      }
      fontFamily={CATEGORY_NAME_SVG.fontFamily}
      fontSize={CATEGORY_NAME_SVG.fontSize}
      fontWeight={CATEGORY_NAME_SVG.fontWeight}
      style={{ cursor: "pointer", transition: "fill 0.2s ease" }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {payload?.value}
    </text>
  );
}

export function AuraHistogram({ data }: HistogramProps) {
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);
  const narrow = useNarrowViewport();
  const n = data.length;

  return (
    <PanelCard glossy glossDelay={-6} className="h-full">
      <div ref={ref} className="flex min-h-0 flex-1 flex-col">
        <PanelLabel>Aura Distribution</PanelLabel>
        <div className="aura-distribution-chart mt-3 min-h-[260px] flex-1">
          <ResponsiveContainer width="100%" height={narrow ? 280 : 260}>
            <BarChart
              key={hasEntered ? "hist-animate" : "hist-idle"}
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap={narrow ? "16%" : "18%"}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickFormatter={narrow ? shortAuraBucket : undefined}
                tick={{
                  fontSize: narrow ? 10 : 12,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--color-text-primary)",
                }}
                interval={0}
                minTickGap={narrow ? 8 : 0}
                angle={narrow ? -50 : -30}
                textAnchor="end"
                height={narrow ? 72 : 60}
                tickMargin={4}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : v.toLocaleString()
                }
                width={narrow ? 36 : 56}
                tick={{
                  fontSize: narrow ? 11 : 12,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--color-text-primary)",
                }}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const value = Number(payload[0]?.value ?? 0);
                  return (
                    <div className="rounded-[4px] border border-[rgba(198,182,186,0.2)] bg-[#1B1A14] px-3 py-2.5 shadow-[0_14px_36px_rgba(0,0,0,.55)]">
                      <p className="m-0 mb-1.5 font-sans text-[13px] font-medium leading-none text-[#FFFEEF]">
                        {String(label)}
                      </p>
                      <div className="grid grid-cols-[auto_auto] gap-x-3 leading-none">
                        <span className="font-label text-text-muted">Wallets</span>
                        <span className="font-data text-right text-[#FFB547]">
                          {value.toLocaleString("en-US")}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="count"
                radius={[2, 2, 0, 0]}
                maxBarSize={narrow ? 22 : 28}
                isAnimationActive={hasEntered}
                activeBar={{
                  fill: CHART_GOLD,
                  stroke: "none",
                  filter: "drop-shadow(0 0 6px rgba(255,181,71,0.35))",
                }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={chartSlateRamp(i, n)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PanelCard>
  );
}

interface CategoryChartsProps {
  data: CategoryBreakdownItem[];
}

interface CategoryChartRow extends CategoryBreakdownItem {
  groupShare: number;
}

function withGroupShares(data: CategoryBreakdownItem[]): CategoryChartRow[] {
  const totalPoints = data.reduce((sum, item) => sum + item.points, 0);
  return data.map((item) => ({
    ...item,
    groupShare: totalPoints > 0 ? (item.points / totalPoints) * 100 : 0,
  }));
}

function collapseSmallCategories(data: CategoryChartRow[]) {
  const MIN_GROUP_SHARE = 1;

  const prominent = data.filter((item) => item.groupShare >= MIN_GROUP_SHARE || item.key === "others");
  const tiny = data.filter((item) => item.groupShare < MIN_GROUP_SHARE && item.key !== "others");

  if (tiny.length === 0 || prominent.length === 0) {
    return { chartData: [...data], othersCategories: [] };
  }

  return {
    chartData: [
      ...prominent,
      {
        key: "others-small",
        category: "Others",
        points: tiny.reduce((sum, item) => sum + item.points, 0),
        share: tiny.reduce((sum, item) => sum + item.share, 0),
        groupShare: tiny.reduce((sum, item) => sum + item.groupShare, 0),
      },
    ],
    othersCategories: tiny.map((item) => ({
      category: item.category,
      points: item.points,
      share: item.share,
      groupShare: item.groupShare,
    })),
  };
}

export function CategoryCharts({ data }: CategoryChartsProps) {
  const groupOptions = useMemo(() => buildCategoryGroupOptions(data), [data]);
  const [selectedGroup, setSelectedGroup] = useState(OVERVIEW_GROUP);
  const narrow = useNarrowViewport();

  useEffect(() => {
    if (!groupOptions.some((option) => option.value === selectedGroup)) {
      setSelectedGroup(OVERVIEW_GROUP);
    }
  }, [groupOptions, selectedGroup]);

  const filtered = useMemo(
    () => filterCategoryBreakdown(data, selectedGroup),
    [data, selectedGroup]
  );

  const isDrillDown = selectedGroup !== OVERVIEW_GROUP;

  const { chartData, othersCategories } = useMemo(() => {
    const withShares = withGroupShares(filtered);
    const collapsed = collapseSmallCategories(withShares);
    return {
      ...collapsed,
      // Largest → smallest, top to bottom, so the bright→dull slate ramp
      // tracks share rank.
      chartData: [...collapsed.chartData].sort((a, b) => b.groupShare - a.groupShare),
    };
  }, [filtered]);

  const colored = useMemo(
    () =>
      chartData.map((row, i) => ({
        ...row,
        // Gold primary + slate ramp — same transfer model as the Overview donut.
        color: chartPrimaryRamp(i, chartData.length),
      })),
    [chartData]
  );

  const segments = useMemo<OverviewDonutSegment[]>(
    () =>
      colored.map((row) => ({
        id: row.key,
        label: row.category,
        color: row.color,
        pct: row.groupShare,
        points: row.points,
      })),
    [colored]
  );

  const totalAuraNumber = useMemo(
    () => colored.reduce((sum, row) => sum + row.points, 0),
    [colored]
  );

  const apexInset = donutApexInset();

  const othersInfo =
    othersCategories.length > 0 ? (
      <span className="block">
        <span className="mb-1.5 block font-medium text-text-primary">
          “Others” combines {othersCategories.length} smaller sources:
        </span>
        <span className="block space-y-0.5">
          {othersCategories.map((c) => (
            <span key={c.category} className="flex justify-between gap-3">
              <span>{c.category}</span>
              <span className="font-data text-text-secondary">
                {formatNumber(c.points)} Aura · {c.groupShare.toFixed(1)}%
              </span>
            </span>
          ))}
        </span>
      </span>
    ) : null;

  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);
  const [sharedHover, setSharedHover] = useState<number | undefined>(undefined);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading eyebrow="Aura" title="Aura analytics" centered />

      <div
        ref={ref}
        className="grid items-stretch gap-4 lg:grid-cols-2"
        onMouseLeave={() => setSharedHover(undefined)}
      >
        <PanelCard glossy glossDelay={-8} className={narrow ? undefined : "min-h-[400px]"}>
          <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <PanelLabel>Source Breakdown</PanelLabel>
              {othersInfo && <InfoTooltip text={othersInfo} panelClassName="w-72" floating />}
            </div>
            <Select
              value={selectedGroup}
              onChange={setSelectedGroup}
              options={groupOptions}
              className="w-[9.5rem] shrink-0"
              compact
            />
          </div>
          {segments.length > 0 && (
            <div className="flex min-h-0 flex-1 items-start">
              <div
                className="flex w-full min-w-0"
                style={narrow ? undefined : { height: AURA_SOURCES_DONUT_WELL }}
              >
                <AuraDonut
                  key={selectedGroup}
                  segments={segments}
                  totalAuraNumber={totalAuraNumber}
                  showShare={false}
                  hoverIndex={sharedHover}
                  onHoverIndexChange={setSharedHover}
                />
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard glossy glossDelay={-11} className={narrow ? undefined : "min-h-[400px]"}>
          <div className="mb-3 flex min-h-8 items-center">
            <div className="flex items-center gap-1.5">
              <PanelLabel>Category Share</PanelLabel>
              {othersInfo && <InfoTooltip text={othersInfo} panelClassName="w-72" floating />}
            </div>
          </div>
          <div
            className="category-share-chart w-full"
            style={{
              height: narrow ? Math.max(220, colored.length * 44) : AURA_SOURCES_DONUT_WELL,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                key={`${hasEntered ? "cat-animate" : "cat-idle"}-${selectedGroup}`}
                data={colored}
                layout="vertical"
                // top margin = donut apex inset so the first bar's top edge
                // shares a line with the ring peak (and CATEGORY / AURA).
                margin={{
                  top: narrow ? 0 : apexInset,
                  left: 4,
                  right: narrow ? 36 : 48,
                  bottom: 8,
                }}
                // Gap 0 so category bands start at margin.top; bars are
                // top-aligned inside each band via the custom shape below.
                barCategoryGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  minTickGap={28}
                  tick={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    fill: "var(--color-text-primary)",
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={narrow ? 92 : isDrillDown ? 128 : 110}
                  interval={0}
                  padding={{ top: 0, bottom: 0 }}
                  tick={(props) => {
                    const i = colored.findIndex((r) => r.category === props.payload?.value);
                    const borrow =
                      sharedHover != null && sharedHover > 0
                        ? colored[sharedHover]?.color
                        : null;
                    return (
                      <CategoryYTick
                        {...props}
                        active={sharedHover === i}
                        dimmed={
                          sharedHover != null &&
                          sharedHover !== i &&
                          !(i === 0 && borrow != null)
                        }
                        onHover={() => i >= 0 && setSharedHover(i)}
                      />
                    );
                  }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as CategoryChartRow | undefined;
                    if (!row) return null;
                    return (
                      <div className="rounded-[4px] border border-[rgba(198,182,186,0.2)] bg-[#1B1A14] px-3 py-2.5 shadow-[0_14px_36px_rgba(0,0,0,.55)]">
                        <p className="m-0 mb-1.5 font-sans text-[13px] font-medium leading-none text-[#FFFEEF]">
                          {String(label)}
                        </p>
                        <div className="grid grid-cols-[auto_auto] gap-x-3 leading-none">
                          <span className="font-label text-text-muted">Share</span>
                          <span className="font-data text-right text-[#FFB547]">
                            {row.groupShare.toFixed(1)}% of group · {row.share.toFixed(2)}% total
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="groupShare"
                  radius={[0, 2, 2, 0]}
                  minPointSize={3}
                  isAnimationActive={hasEntered}
                  activeBar={false}
                  onMouseEnter={(_, i) => setSharedHover(i)}
                  // Top-align within each category band so the first bar's
                  // upper edge sits on margin.top (donut apex), not centred
                  // several px below it.
                  shape={(props: unknown) => {
                    const p = props as RectangleProps & { index?: number; className?: string };
                    const h = Math.min(28, Number(p.height) || 28);
                    const idx = typeof p.index === "number" ? p.index : -1;
                    const pulsing = idx >= 0 && sharedHover === idx;
                    if (!pulsing) {
                      return (
                        <Rectangle
                          {...p}
                          height={h}
                          radius={[0, 2, 2, 0]}
                        />
                      );
                    }
                    // Idle primary is gold — bed it on slate like every other
                    // slice so the opacity beat reads gold↔gray, not gold↔gold.
                    const idle = colored[idx]?.color ?? CHART_GOLD;
                    const bed =
                      idx === 0 || idle === CHART_GOLD
                        ? CHART_GOLD_PULSE_UNDERLAY
                        : idle;
                    const geom = {
                      x: p.x,
                      y: p.y,
                      width: p.width,
                      height: h,
                      radius: [0, 2, 2, 0] as [number, number, number, number],
                    };
                    return (
                      <g>
                        <Rectangle {...geom} fill={bed} />
                        <motion.g
                          key={`bar-pulse-${idx}`}
                          initial={{ opacity: 1 }}
                          animate={CHART_GOLD_PULSE}
                          transition={CHART_GOLD_PULSE_TRANSITION}
                        >
                          <Rectangle {...geom} fill={CHART_GOLD} />
                        </motion.g>
                      </g>
                    );
                  }}
                >
                  {colored.map((row, i) => {
                    const borrow =
                      sharedHover != null && sharedHover > 0
                        ? colored[sharedHover].color
                        : null;
                    const fill =
                      sharedHover === i
                        ? CHART_GOLD
                        : i === 0 && borrow != null
                          ? borrow
                          : row.color;
                    return (
                      <Cell
                        key={row.key}
                        fill={fill}
                        opacity={
                          sharedHover == null ||
                          sharedHover === i ||
                          (i === 0 && borrow != null)
                            ? 1
                            : 0.4
                        }
                        style={{ transition: "fill 0.25s ease" }}
                      />
                    );
                  })}
                  <LabelList
                    dataKey="groupShare"
                    position="right"
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    fill="var(--color-text-primary)"
                    fontSize={12}
                    fontFamily="var(--font-mono), ui-monospace, monospace"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
