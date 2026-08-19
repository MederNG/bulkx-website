"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartRange } from "@/types";
import type { ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import {
  formatSignedUsd,
  formatSnapshotUtc,
  formatSnapshotUtcParts,
  formatUsdCompact,
} from "@/lib/projected-snapshot-tvl";
import { cn, formatNumber } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Select } from "@/components/ui/Select";
import { PageHeading } from "@/components/layout/PageHeading";
import { AuraDonut, AURA_SOURCES_DONUT_WELL, donutApexInset } from "@/components/overview/AuraDonut";
import { PanelCard, PanelLabel } from "@/components/overview/PanelCard";
import { DONUT_COLORS, type OverviewDonutSegment } from "@/lib/overview-metrics";
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
        <p className="font-medium text-accent">Projected TVL</p>
        <p className="mt-1 font-mono tabular-nums text-text-primary">
          {formatUsdCompact(projection.projectedTvl)}
        </p>
        <p className="mt-2 text-text-secondary">Weighted Daily Flow</p>
        <p className="mt-0.5 font-mono tabular-nums text-bid-green">
          {formatSignedUsd(projection.weightedDailyFlow, true)}/day
        </p>
        <p className="mt-2 text-text-secondary">Snapshot</p>
        <p className="mt-0.5 text-text-primary">{snapshotParts.date}</p>
        <p className="text-text-primary">{snapshotParts.time}</p>
        <p className="mt-2 text-text-secondary">Expected Growth</p>
        <p className="mt-0.5 font-mono tabular-nums text-bid-green">
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
      <p className="text-text-secondary">
        {new Date(label).toLocaleString("en-US", { timeZone: "UTC" })} UTC
      </p>
      <p className="mt-1 font-mono tabular-nums text-text-primary">${tvl.toLocaleString("en-US")}</p>
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
    <div ref={ref} className="card p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">TVL History &amp; Projection</p>
          <InfoTooltip
            floating
            text="Historical TVL from hourly snapshots. The dashed line projects TVL to the next weekly snapshot using weighted 7-day TVL growth."
          />
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn("btn-ghost !px-2 !py-1 !text-[11px]", range === r && "active")}
            >
              {r}
            </button>
          ))}
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

export function AuraHistogram({ data }: HistogramProps) {
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  return (
    <PanelCard glossy glossDelay={-6} className="h-full">
      <div ref={ref} className="flex min-h-0 flex-1 flex-col">
        <PanelLabel>Aura Distribution</PanelLabel>
        <div className="aura-distribution-chart mt-3 min-h-[260px] flex-1">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart key={hasEntered ? "hist-animate" : "hist-idle"} data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tick={{
                  fontSize: 13,
                  fontFamily: "var(--font-ibm-plex-sans)",
                  fill: "var(--color-text-primary)",
                }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tickFormatter={(v) => v.toLocaleString()}
                width={56}
                tick={{
                  fontSize: 13,
                  fontFamily: "var(--font-ibm-plex-sans)",
                  fill: "var(--color-text-primary)",
                }}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  background: "#1B1A14",
                  border: "1px solid rgba(198,182,186,0.2)",
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: "var(--font-ibm-plex-sans)",
                }}
                itemStyle={{ color: "#FFB547" }}
                labelStyle={{ color: "#FFFEEF" }}
                formatter={(value: number) => [value.toLocaleString(), "Wallets"]}
              />
              <Bar
                dataKey="count"
                radius={[2, 2, 0, 0]}
                isAnimationActive={hasEntered}
                activeBar={{
                  stroke: "#FFFEEF",
                  strokeWidth: 1,
                  filter: "drop-shadow(0 0 6px rgba(255,181,71,0.45))",
                }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
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

function collapseSmallCategories(data: CategoryChartRow[], topN: number = 7) {
  const MIN_GROUP_SHARE = 2.5;

  const prominent = data.filter((item) => item.groupShare >= MIN_GROUP_SHARE || item.key === "others");
  const tiny = data.filter((item) => item.groupShare < MIN_GROUP_SHARE && item.key !== "others");

  let working =
    tiny.length > 0 && prominent.length > 0
      ? [
          ...prominent,
          {
            key: "others-small",
            category: "Others",
            points: tiny.reduce((sum, item) => sum + item.points, 0),
            share: tiny.reduce((sum, item) => sum + item.share, 0),
            groupShare: tiny.reduce((sum, item) => sum + item.groupShare, 0),
          },
        ]
      : [...data];

  if (working.length <= topN + 1) {
    const othersCategories =
      tiny.length > 0
        ? tiny.map((item) => ({
            category: item.category,
            points: item.points,
            share: item.share,
            groupShare: item.groupShare,
          }))
        : [];
    return { chartData: working, othersCategories };
  }

  const head = working.slice(0, topN);
  const rest = working.slice(topN);
  return {
    chartData: [
      ...head,
      {
        key: "others",
        category: "Others",
        points: rest.reduce((sum, item) => sum + item.points, 0),
        share: rest.reduce((sum, item) => sum + item.share, 0),
        groupShare: rest.reduce((sum, item) => sum + item.groupShare, 0),
      },
    ],
    othersCategories: rest.map((item) => ({
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
    // Overview buckets are Retro/Week N/Other — a bounded, meaningful set that
    // should never be swallowed into "Others" just because the campaign has
    // run long enough to exceed the drill-down TOP_N.
    const collapsed = collapseSmallCategories(withShares, isDrillDown ? 7 : Number.POSITIVE_INFINITY);
    return {
      ...collapsed,
      // Largest to smallest, top to bottom — and gold on the biggest slice,
      // the same assignment the Overview ring uses.
      chartData: [...collapsed.chartData].sort((a, b) => b.groupShare - a.groupShare),
    };
  }, [filtered, isDrillDown]);

  const colored = useMemo(
    () =>
      chartData.map((row, i) => ({
        ...row,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
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
              <span className="tabular-nums text-text-secondary">
                {formatNumber(c.points)} Aura · {c.groupShare.toFixed(1)}%
              </span>
            </span>
          ))}
        </span>
      </span>
    ) : null;

  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading eyebrow="Aura" title="Aura analytics" centered />

      <div ref={ref} className="grid items-stretch gap-4 lg:grid-cols-2">
        <PanelCard glossy glossDelay={-8} className="min-h-[400px]">
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
            <div className="flex min-h-[320px] flex-1 items-start">
              <div
                className="flex w-full min-w-0"
                style={{ height: AURA_SOURCES_DONUT_WELL }}
              >
                <AuraDonut
                  key={selectedGroup}
                  segments={segments}
                  totalAuraNumber={totalAuraNumber}
                  showShare={false}
                />
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard glossy glossDelay={-11}>
          <div className="mb-3 flex min-h-8 items-center">
            <div className="flex items-center gap-1.5">
              <PanelLabel>Category Share</PanelLabel>
              {othersInfo && <InfoTooltip text={othersInfo} panelClassName="w-72" floating />}
            </div>
          </div>
          <div
            className="category-share-chart w-full"
            style={{ height: AURA_SOURCES_DONUT_WELL, paddingTop: apexInset }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                key={`${hasEntered ? "cat-animate" : "cat-idle"}-${selectedGroup}`}
                data={colored}
                layout="vertical"
                margin={{ top: 0, left: 4, right: 48, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{
                    fontSize: 13,
                    fontFamily: "var(--font-ibm-plex-sans)",
                    fill: "var(--color-text-primary)",
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={isDrillDown ? 128 : 110}
                  tick={{
                    fontSize: 13,
                    fontFamily: "var(--font-ibm-plex-sans)",
                    fill: "var(--color-text-primary)",
                  }}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "#1B1A14",
                    border: "1px solid rgba(198,182,186,0.2)",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: "var(--font-ibm-plex-sans)",
                  }}
                  itemStyle={{ color: "#FFFEEF" }}
                  labelStyle={{ color: "#FFFEEF" }}
                  formatter={(value: number, _name, item) => {
                    const row = item.payload as CategoryChartRow;
                    return [
                      `${Number(value).toFixed(1)}% of group · ${row.share.toFixed(2)}% total`,
                      "Share",
                    ];
                  }}
                />
                <Bar
                  dataKey="groupShare"
                  radius={[0, 2, 2, 0]}
                  minPointSize={3}
                  isAnimationActive={hasEntered}
                  activeBar={{
                    fill: "#FFC764",
                    stroke: "#FFB547",
                    strokeWidth: 1,
                    filter: "drop-shadow(0 0 6px rgba(255,181,71,0.45))",
                  }}
                >
                  {colored.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                  <LabelList
                    dataKey="groupShare"
                    position="right"
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    fill="var(--color-text-primary)"
                    fontSize={13}
                    fontFamily="var(--font-ibm-plex-sans)"
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
