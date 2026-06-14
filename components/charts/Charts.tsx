"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { cn, formatNumber } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

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
  if (!percent || percent <= 0.04) return null;
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

interface TvlChartProps {
  data: { timestamp: string; tvl: number; totalAura: number }[];
}

export function TvlChart({ data }: TvlChartProps) {
  const [range, setRange] = useState<ChartRange>("7D");
  const ranges: ChartRange[] = ["24H", "7D", "30D", "ALL"];
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  const filtered = filterByRange(data, range);

  return (
    <div ref={ref} className="card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium">TVL History</p>
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
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart key={hasEntered ? "tvl-animate" : "tvl-idle"} data={filtered}>
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
              new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            minTickGap={30}
          />
          <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={60} />
          <Tooltip
            contentStyle={{
              background: "#1B1A14",
              border: "1px solid rgba(198,182,186,0.2)",
              borderRadius: 4,
              fontSize: 12,
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, "TVL"]}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Area
            type="monotone"
            dataKey="tvl"
            stroke="#FFB547"
            fill="url(#tvlGrad)"
            strokeWidth={2}
            isAnimationActive={hasEntered}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function filterByRange(
  data: { timestamp: string; tvl: number; totalAura: number }[],
  range: ChartRange
) {
  if (range === "ALL") return data;
  const now = Date.now();
  const ms =
    range === "24H" ? 86400000 : range === "7D" ? 7 * 86400000 : 30 * 86400000;
  return data.filter((d) => now - new Date(d.timestamp).getTime() <= ms);
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
  data: { category: string; points: number; share: number }[];
}

export function CategoryCharts({ data }: CategoryChartsProps) {
  const top = data.slice(0, 8);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const { ref, hasEntered } = useInViewOnce<HTMLDivElement>(0.2);

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4 md:p-5">
        <p className="mb-4 text-sm font-medium">Source Breakdown</p>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart key={hasEntered ? "pie-animate" : "pie-idle"}>
            <Pie
              data={top}
              dataKey="points"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              label={activeIndex === undefined ? renderPieLabel : undefined}
              labelLine={false}
              isAnimationActive={hasEntered}
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {top.map((_, i) => (
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
              formatter={(value: number, name: string) => [formatNumber(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-4 md:p-5">
        <p className="mb-4 text-sm font-medium">Category Share</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart key={hasEntered ? "cat-animate" : "cat-idle"} data={top} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 10 }} />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "#1B1A14",
                border: "1px solid rgba(198,182,186,0.2)",
                borderRadius: 4,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Share"]}
            />
            <Bar
              dataKey="share"
              radius={[0, 2, 2, 0]}
              isAnimationActive={hasEntered}
              activeBar={{
                fill: "#FFC764",
                stroke: "#FFB547",
                strokeWidth: 1,
                filter: "drop-shadow(0 0 6px rgba(255,181,71,0.45))",
              }}
            >
              {top.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
