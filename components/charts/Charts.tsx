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
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
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
import { cn, formatNumber, formatUsd } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Select } from "@/components/ui/Select";
import {
  OVERVIEW_GROUP,
  buildCategoryGroupOptions,
  filterCategoryBreakdown,
  type CategoryBreakdownItem,
} from "@/lib/aura-category-groups";

const COLORS = [
  "#FFB547", // accent gold
  "#00B481", // bid green
  "#4FA3C7", // teal blue
  "#EF4A3C", // ask red
  "#E0A458", // amber
  "#8AB17D", // sage
  "#C77DCB", // soft violet
  "#E07A5F", // terracotta
  "#5FBfB3", // aqua
  "#D9C36B", // straw
  "#B07AA1", // mauve
  "#7A9CC6", // dusty blue
];

interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  percent: number;
}

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

function renderPieLabel({ cx, cy, midAngle, outerRadius, percent }: PieLabelProps) {
  if (!percent || percent <= 0.02) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 16;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#FFFEEF"
      fontSize={11}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  percent: number;
  payload: { category: string };
}

function renderActiveShape(rawProps: unknown) {
  const props = rawProps as ActiveShapeProps;
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, percent, payload } = props;
  const approxCharsPerLine = Math.max(10, Math.floor((innerRadius * 2 - 12) / 6));
  const words = payload.category.split(" ");
  const labelLines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const next = currentLine ? `${currentLine} ${word}` : word;
    if (next.length <= approxCharsPerLine || !currentLine) {
      currentLine = next;
    } else {
      labelLines.push(currentLine);
      currentLine = word;
      if (labelLines.length === 1) break;
    }
  }
  if (labelLines.length < 2 && currentLine) labelLines.push(currentLine);

  let [line1 = "", line2 = ""] = labelLines;
  if (line2) {
    if (line2.length > approxCharsPerLine) {
      line2 = `${line2.slice(0, Math.max(approxCharsPerLine - 1, 1)).trim()}…`;
    } else if (words.join(" ").length > `${line1} ${line2}`.trim().length) {
      line2 = `${line2.slice(0, Math.max(approxCharsPerLine - 1, 1)).trim()}…`;
    }
  } else if (line1.length > approxCharsPerLine) {
    line1 = `${line1.slice(0, Math.max(approxCharsPerLine - 1, 1)).trim()}…`;
  }

  const isTwoLine = Boolean(line2);
  const titleY = isTwoLine ? cy - 12 : cy - 6;
  const percentY = isTwoLine ? cy + 18 : cy + 13;

  return (
    <g>
      <text x={cx} y={titleY} textAnchor="middle" fill="#FFFEEF" fontSize={10}>
        <tspan x={cx} dy="0">
          {line1}
        </tspan>
        {isTwoLine && (
          <tspan x={cx} dy="12">
            {line2}
          </tspan>
        )}
      </text>
      <text x={cx} y={percentY} textAnchor="middle" fill="#FFB547" fontSize={14} fontWeight={600}>
        {`${(percent * 100).toFixed(1)}%`}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#FFB547"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 6px rgba(255,181,71,0.45))" }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 11}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="rgba(255,181,71,0.22)"
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 14}
        outerRadius={outerRadius + 16}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="#FFB547"
        style={{ filter: "drop-shadow(0 0 8px rgba(255,181,71,0.55))" }}
      />
    </g>
  );
}

interface TvlChartPoint {
  timestamp: string;
  tvl?: number | null;
  projectedTvl?: number | null;
  isProjectionEndpoint?: boolean;
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
    points.push({ timestamp: nowIso, tvl: bridgeTvl, projectedTvl: bridgeTvl });
  } else {
    lastHistorical.tvl = bridgeTvl;
    lastHistorical.projectedTvl = bridgeTvl;
  }

  const bridge = points[points.length - 1];
  if (bridge) {
    bridge.projectedTvl = bridgeTvl;
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

export function TvlChart({ data, currentTvl, projection, referenceTimeMs }: TvlChartProps) {
  const [range, setRange] = useState<ChartRange>("7D");
  const ranges: ChartRange[] = ["24H", "7D", "30D", "ALL"];
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  const filtered = filterByRange(data, range, referenceTimeMs);
  const chartData = useMemo(
    () => buildTvlChartData(filtered, currentTvl, projection, referenceTimeMs),
    [filtered, currentTvl, projection, referenceTimeMs]
  );

  const projectionEnd = projection.available
    ? chartData.find((p) => p.isProjectionEndpoint)
    : undefined;

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
            Historical TVL
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-[#FFB547]"
              style={{ opacity: 0.5 }}
            />
            Projected TVL
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

        {projection.available && projectionEnd && (
          <div className="pointer-events-none absolute right-2 top-6 hidden rounded border border-[rgba(255,181,71,0.35)] bg-[rgba(20,19,16,0.92)] px-2.5 py-1.5 text-right md:block">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">Projected TVL</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-accent">
              {formatUsd(projection.projectedTvl)}
            </p>
          </div>
        )}
      </div>

      {projection.available && (
        <div className="mt-4 rounded border border-[rgba(198,182,186,0.12)] bg-[rgba(255,254,239,0.02)] p-3">
          <p className="text-xs font-medium text-text-primary">How Projection Works</p>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Projected TVL is calculated using a weighted average of net TVL growth over the last 7
            days.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Recent days receive greater weighting than older days, allowing the projection to react
            to changing deposit trends while reducing the impact of isolated outliers.
          </p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-text-secondary">
            Weighted Daily Flow = Σ(Net Flow × Weight) / Σ(Weight)
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-text-secondary">
            Projected TVL = Current TVL + (Weighted Daily Flow × Remaining Days)
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            This projection assumes the recent trend continues until the next snapshot.
          </p>
        </div>
      )}
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
    <div ref={ref} className="card p-4 md:p-5">
      <p className="mb-4 text-sm font-medium">Aura Distribution</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart key={hasEntered ? "hist-animate" : "hist-idle"} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
          <YAxis tickFormatter={(v) => v.toLocaleString()} width={50} />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#1B1A14",
              border: "1px solid rgba(198,182,186,0.2)",
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="count"
            fill="#FFB547"
            radius={[2, 2, 0, 0]}
            isAnimationActive={hasEntered}
            activeBar={{
              fill: "#FFC764",
              stroke: "#FFB547",
              strokeWidth: 1,
              filter: "drop-shadow(0 0 6px rgba(255,181,71,0.45))",
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LorenzProps {
  data: { cumulativeWallets: number; cumulativeAura: number }[];
}

export function LorenzChart({ data }: LorenzProps) {
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  return (
    <div ref={ref} className="card p-4 md:p-5">
      <p className="mb-4 flex items-center gap-1.5 text-sm font-medium">
        Lorenz Curve
        <InfoTooltip text="Plots the cumulative share of total AURA (vertical) held by the cumulative share of wallets (horizontal), ranked from lowest to highest AURA. The dashed diagonal is perfect equality; the more the gold curve bows below it, the more AURA is concentrated among the top holders." />
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart key={hasEntered ? "lorenz-animate" : "lorenz-idle"} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="cumulativeWallets"
            type="number"
            domain={[0, 100]}
            ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
          />
          <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} width={45} />
          <Tooltip
            contentStyle={{
              background: "#1B1A14",
              border: "1px solid rgba(198,182,186,0.2)",
              borderRadius: 4,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name === "cumulativeAura" ? "Aura Share" : "Equality",
            ]}
          />
          <Line
            type="monotone"
            dataKey="cumulativeAura"
            stroke="#FFB547"
            strokeWidth={2}
            dot={false}
            isAnimationActive={hasEntered}
          />
          <Line
            type="monotone"
            dataKey="cumulativeWallets"
            stroke="#544A4C"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={hasEntered}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
  const TOP_N = 7;
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

  if (working.length <= TOP_N + 1) {
    const othersCategories =
      tiny.length > 0
        ? tiny.map((item) => ({ category: item.category, share: item.share, groupShare: item.groupShare }))
        : [];
    return { chartData: working, othersCategories };
  }

  const head = working.slice(0, TOP_N);
  const rest = working.slice(TOP_N);
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

  const { chartData, othersCategories } = useMemo(() => {
    const withShares = withGroupShares(filtered);
    return collapseSmallCategories(withShares);
  }, [filtered]);

  const isDrillDown = selectedGroup !== OVERVIEW_GROUP;
  const barHeight = Math.max(260, chartData.length * 42);

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
                {c.groupShare.toFixed(1)}% · {c.share.toFixed(2)}% total
              </span>
            </span>
          ))}
        </span>
      </span>
    ) : null;

  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  useEffect(() => {
    setActiveIndex(undefined);
  }, [selectedGroup]);

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4 md:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Source Breakdown
            {othersInfo && <InfoTooltip text={othersInfo} panelClassName="w-72" floating />}
          </p>
          <Select
            value={selectedGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
            className="w-[9.5rem] shrink-0"
            compact
          />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart key={`${hasEntered ? "pie-animate" : "pie-idle"}-${selectedGroup}`}>
            <Pie
              data={chartData}
              dataKey="groupShare"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              minAngle={5}
              paddingAngle={chartData.length > 5 ? 1 : 2}
              label={activeIndex === undefined ? renderPieLabel : undefined}
              labelLine={false}
              isAnimationActive={hasEntered}
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#141310" strokeWidth={1} />
              ))}
            </Pie>
            <Legend
              formatter={(value) => (
                <span style={{ color: "#FFFEEF", fontSize: 11 }}>{value}</span>
              )}
            />
            <Tooltip
              contentStyle={{
                background: "#1B1A14",
                border: "1px solid rgba(198,182,186,0.2)",
                borderRadius: 4,
                fontSize: 12,
              }}
              itemStyle={{ color: "#FFFEEF" }}
              labelStyle={{ color: "#FFFEEF" }}
              formatter={(value: number, name: string, item) => {
                const row = item.payload as CategoryChartRow;
                return [
                  `${Number(value).toFixed(1)}% of group · ${row.share.toFixed(2)}% total · ${formatNumber(row.points)} Aura`,
                  name,
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-4 md:p-5">
        <div className="mb-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Category Share
            {othersInfo && <InfoTooltip text={othersInfo} panelClassName="w-72" floating />}
          </p>
          {isDrillDown && (
            <p className="mt-1 text-xs text-text-secondary">Share within selected group</p>
          )}
        </div>
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart
            key={`${hasEntered ? "cat-animate" : "cat-idle"}-${selectedGroup}`}
            data={chartData}
            layout="vertical"
            margin={{ left: 4, right: 48 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={[0, "dataMax"]}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="category"
              width={isDrillDown ? 118 : 100}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "#1B1A14",
                border: "1px solid rgba(198,182,186,0.2)",
                borderRadius: 4,
                fontSize: 12,
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
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList
                dataKey="groupShare"
                position="right"
                formatter={(value: number) => `${value.toFixed(1)}%`}
                fill="#FFFEEF"
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
