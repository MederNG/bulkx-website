"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectedSnapshotTvl } from "@/lib/projected-snapshot-tvl";
import { CHART_GOLD } from "@/lib/overview-metrics";
import { cn } from "@/lib/utils";
import type { Snapshot } from "@/types";

const RANGES = ["7D", "30D", "ALL"] as const;
type Range = (typeof RANGES)[number];

/** Width of BOTH toggle groups in this panel — the Current/Projected pair
 * above and this range row below. They sit one under the other against the
 * same right edge, so unequal widths read as a ragged left edge between two
 * controls that are obviously a set. One number, applied to both groups,
 * with the buttons inside each dividing it evenly; that's what keeps them
 * matched whatever the labels say. Sized to the wider group's own needs —
 * "Projected" in a 74px half. Exported for TvlPanel, which renders the
 * other one. */
export const TVL_TOGGLE_GROUP_W = 158;

/** Width of the value axis's band on the right of the plot. Also the shift
 * applied to each label so it ends on the chart's right edge — see the YAxis
 * below. */
const Y_AXIS_W = 56;

/** Hairline so the first dot isn't clipped by the plot's left edge. The
 * first reading itself sits on that edge, flush with the legend above. */
const PLOT_PAD_L = 8;

const RANGE_MS: Record<Exclude<Range, "ALL">, number> = {
  "7D": 7 * 86_400_000,
  "30D": 30 * 86_400_000,
};

/** The caption a reading carries on the axis. */
function formatAxisDate(t: number): string {
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

interface Point {
  /** Position on the axis, in label-steps — see the chart memo below. */
  x: number;
  /** The reading's real timestamp, kept for the tooltip. */
  t: number;
  tvl: number | null;
  projected: number | null;
}

function usdCompact(value: number): string {
  return `$${(value / 1e6).toFixed(1)}M`;
}

/** Rounds a rough step up to one people count in — 1, 2, 2.5 or 5 times a
 * power of ten. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalised = rough / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * A value axis fitted to the data but landing on readable numbers.
 *
 * Computed here rather than left to Recharts' own "auto" because the range
 * switch has to be able to travel between two of these. Recharts recomputes
 * its scale the instant the underlying points change, which put the entire
 * vertical rescale into the single frame where a switch landed — the whole
 * curve flinching at the end of an otherwise smooth move.
 */
function niceValueDomain(min: number, max: number): { lo: number; hi: number; step: number } {
  if (!(max > min)) {
    const step = niceStep(Math.max(Math.abs(max), 1) / 4);
    return { lo: min - step, hi: max + step, step };
  }
  const step = niceStep((max - min) / 4);
  let lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  // Keep the lowest reading off the axis floor. On phones the card gloss
  // pools in that band and a gold stroke sitting on $22.0M washes out.
  if (min - lo < step * 0.25) lo -= step;
  return { lo, hi, step };
}

const DAY_MS = 86_400_000;

/** Room one "Aug 08" needs in Overpass Mono 12px before it touches its
 * neighbour. The glyphs run ~52–56px wide; 72 leaves ~16px of air. */
const MIN_LABEL_SPACING_PX = 72;



/** A date label, centred on its tick — except the first (flush left) and
 * the last (flush right), so end captions don't spill into their neighbour. */
function AxisDateTick({
  x,
  y,
  payload,
  labels,
}: {
  x?: number;
  y?: number;
  payload?: { value: number };
  /** One caption per tick, indexed by the tick's own value. */
  labels?: string[];
}) {
  if (x == null || y == null || !payload) return null;
  const last = labels != null && payload.value === labels.length - 1;
  const anchor = payload.value === 0 ? "start" : last ? "end" : "middle";

  return (
    <text
      x={x}
      y={y + 12}
      textAnchor={anchor}
      fill="var(--color-text-secondary)"
      fontSize={11}
      fontFamily="var(--font-mono)"
    >
      {labels?.[payload.value] ?? ""}
    </text>
  );
}

/** Only captioned readings get a mark. In-between days sit on the line but
 * would otherwise cluster against a labelled neighbour when that step spans
 * several dates (Aug 16 sitting on a tick, Aug 17 a few pixels later). */
function TvlDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: Point;
}) {
  if (cx == null || cy == null || payload?.tvl == null) return null;
  if (Math.abs(payload.x - Math.round(payload.x)) > 1e-6) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={1.5}
      fill={CHART_GOLD}
      stroke="#0b0b0c"
      strokeWidth={1.1}
    />
  );
}

/**
 * Historical TVL as a filled area, continuing into the projection as a dashed
 * line. The two series share an axis so the hand-off reads as one curve.
 */
export function HeroTvlChart({
  snapshots,
  currentTvl,
  projection,
  referenceTimeMs,
  showProjection = true,
  viewToggle,
}: {
  snapshots: Snapshot[];
  currentTvl: number;
  projection: ProjectedSnapshotTvl;
  referenceTimeMs: number;
  /** The forward-looking line belongs to the projected view only. */
  showProjection?: boolean;
  /** The panel's Current/Projected control, rendered here so it shares a row
   * with the range buttons instead of costing the chart a second line. */
  viewToggle?: React.ReactNode;
}) {
  const [range, setRange] = useState<Range>("7D");
  const withProjection = showProjection && projection.available;

  // Plot width only — used to keep the x-axis from asking for more date
  // labels than actually fit side by side.
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  /** That width minus the y-axis gutter, the chart's right margin and the
   * left reserve — the strip the date labels actually have to share. */
  const labelStripWidth = Math.max(0, wrapWidth - Y_AXIS_W - 8 - PLOT_PAD_L);

  // Range switching is immediate. It used to ease the window from the old
  // range to the new one over about a second, which meant the axes had to be
  // interpolated, frozen or re-derived frame by frame alongside it — every one
  // of those showed as the labels shifting or flickering while the curve
  // travelled. Switching outright costs nothing and the axes are simply
  // correct from the first frame.
  const changeRange = setRange;

  /**
   * The series, its axis and its captions, all built together.
   *
   * The x axis is NOT time. It is measured in label steps: the captioned
   * readings sit on whole numbers 0, 1, 2 … k, and everything drawn between
   * two of them is placed by how many daily readings sit inside that step
   * (not by the raw timestamps). Timestamp spacing inside a step is what
   * glued Aug 16 to Aug 17 when the next caption was Aug 20: one day of a
   * four-day interval, a few pixels from the tick.
   *
   * One reading per UTC day, with live TVL replacing today's snapshot rather
   * than sitting a few hours beside it — that pair was the extra mark over
   * "Aug 20".
   */
  const chart = useMemo(() => {
    const history = snapshots
      .map((p) => ({ t: Date.parse(p.timestamp), tvl: p.tvl }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);

    const windowed =
      range === "ALL"
        ? history
        : history.filter((p) => referenceTimeMs - p.t <= RANGE_MS[range]);

    // Last snapshot of each UTC day — opening-day bursts and a same-day live
    // reading would otherwise each claim a mark a few pixels apart.
    const byDay = new Map<number, { t: number; tvl: number }>();
    for (const p of windowed) {
      byDay.set(Math.floor(p.t / DAY_MS), p);
    }
    const today = Math.floor(referenceTimeMs / DAY_MS);
    const existingToday = byDay.get(today);
    byDay.set(today, {
      t: Math.max(existingToday?.t ?? 0, referenceTimeMs),
      tvl: currentTvl,
    });

    const readings: { t: number; tvl: number | null; projected: number | null }[] = [
      ...byDay.entries(),
    ]
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => ({ t: p.t, tvl: p.tvl, projected: null }));
    const lastReading = readings[readings.length - 1];
    if (lastReading) lastReading.projected = lastReading.tvl;

    if (readings.length < 2) {
      const points: Point[] = readings.map((r, idx) => ({ x: idx, ...r }));
      const only = points[0]?.tvl ?? 0;
      return {
        points,
        ticks: points.map((_, idx) => idx),
        labels: points.map((p) => formatAxisDate(p.t)),
        xMax: Math.max(1, points.length - 1),
        value: niceValueDomain(only, only),
      };
    }

    const lastIdx = readings.length - 1;
    const rungCount = readings.length;

    // Projection lengthens the domain past the last historical tick, which
    // compresses every label. Count that stretch before choosing how many
    // captions fit, otherwise 7D Projected on a phone glues Aug 14 to Aug 15.
    const spanMs = readings[lastIdx].t - readings[0].t;
    const projMs =
      withProjection && projection.available
        ? Math.max(0, projection.nextSnapshotTimestamp - readings[lastIdx].t)
        : 0;
    const stretch = spanMs > 0 ? 1 + projMs / spanMs : 1;
    // 30D / ALL need fewer captions — daily-ish ticks pack "Aug 08" into
    // each other even after the mono spacing floor. Cap the rung count so
    // those windows read as a handful of dates, not a crowded strip.
    const maxSteps =
      range === "ALL" ? 4 : range === "30D" ? 5 : rungCount - 1;
    const steps = Math.max(
      1,
      Math.min(
        maxSteps,
        rungCount - 1,
        Math.max(1, Math.floor(labelStripWidth / MIN_LABEL_SPACING_PX / stretch))
      )
    );

    const captionAt = Array.from(
      { length: steps + 1 },
      (_, j) => Math.round((j * (rungCount - 1)) / steps)
    ).filter((idx, i, arr) => i === 0 || idx !== arr[i - 1]);
    const captionSteps = Math.max(1, captionAt.length - 1);

    const xs = new Array<number>(readings.length);
    for (let j = 0; j < captionSteps; j++) {
      const a = captionAt[j];
      const b = captionAt[j + 1];
      for (let idx = a; idx <= b; idx++) {
        xs[idx] = b > a ? j + (idx - a) / (b - a) : j;
      }
    }

    const points: Point[] = readings.map((r, idx) => ({ x: xs[idx], ...r }));
    let xMax = captionSteps;

    if (withProjection && projection.available) {
      const stepMs = spanMs / captionSteps;
      const x =
        stepMs > 0
          ? captionSteps + (projection.nextSnapshotTimestamp - readings[lastIdx].t) / stepMs
          : captionSteps;
      points.push({
        x,
        t: projection.nextSnapshotTimestamp,
        tvl: null,
        projected: projection.projectedTvl,
      });
      xMax = x;
    }

    const values = points.map((p) => p.tvl ?? p.projected).filter((v): v is number => v != null);

    return {
      points,
      ticks: Array.from({ length: captionSteps + 1 }, (_, j) => j),
      labels: captionAt.map((idx) => formatAxisDate(readings[idx].t)),
      xMax,
      value: values.length
        ? niceValueDomain(Math.min(...values), Math.max(...values))
        : niceValueDomain(0, 1),
    };
  }, [snapshots, range, referenceTimeMs, currentTvl, projection, withProjection, labelStripWidth]);

  const data = chart.points;
  const yLo = chart.value.lo;
  const yHi = chart.value.hi;
  const yTicks = useMemo(() => {
    const step = chart.value.step;
    const out: number[] = [];
    for (let v = Math.ceil(yLo / step) * step; v <= yHi + step * 1e-6; v += step) out.push(v);
    return out;
  }, [yLo, yHi, chart.value.step]);

  useEffect(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) return;

    const sync = () => setWrapWidth(wrap.clientWidth);
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Both controls on one line: what is being plotted on the left, over
          what window on the right. They used to sit on two lines, the view
          toggle alone above and the ranges sharing the next line with the
          legend — which put a control and a caption on the same row and two
          controls on different ones, the opposite of how they group. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">{viewToggle}</div>
        {/* flex-1 on the buttons rather than letting each size to its own
            label: "7D", "30D" and "ALL" are 14, 21 and 18px of text, so
            content-sized pills came out three different widths inside a
            group that is meant to read as one control. Same width as the view
            toggle beside it — see TVL_TOGGLE_GROUP_W. */}
        <div className="term-seg" style={{ width: TVL_TOGGLE_GROUP_W }}>
          {RANGES.map((r) => {
            const on = r === range;
            return (
              <button
                key={r}
                type="button"
                onClick={() => changeRange(r)}
                aria-pressed={on}
                className={cn("term-seg-btn", on ? "is-on" : "is-off")}
              >
                {on && (
                  <motion.span
                    layoutId="tvl-range-toggle-pill"
                    className="term-seg-pill"
                    aria-hidden="true"
                    transition={{ type: "spring", stiffness: 480, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-text-muted select-none [-webkit-touch-callout:none]">
        <span className="inline-flex items-center gap-[7px]">
          <span className="h-[2px] w-4 bg-accent" />
          Historical TVL
        </span>
        {withProjection && (
          <span className="inline-flex items-center gap-[7px]">
            <span className="w-4 border-t-2 border-dashed border-accent" />
            Projected TVL
          </span>
        )}
      </div>

      <div ref={chartWrapRef} className="hero-tvl-chart relative mt-2 min-h-[220px] flex-1 overflow-hidden xl:min-h-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={90}>
          <ComposedChart
            data={data}
            margin={{ top: 6, right: 8, bottom: 4, left: PLOT_PAD_L }}
          >
            <defs>
              <linearGradient id="heroTvlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,181,71,0.12)" />
                <stop offset="100%" stopColor="rgba(255,181,71,0)" />
              </linearGradient>
              {/* Softly fades the line's own opacity toward both ends —
                  objectBoundingBox coordinates, so 0%/100% track the line's
                  own left/right extent regardless of the visible range. */}
              <linearGradient id="heroTvlLineFade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={CHART_GOLD} stopOpacity={0} />
                <stop offset="7%" stopColor={CHART_GOLD} stopOpacity={1} />
                <stop offset="100%" stopColor={CHART_GOLD} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            {/* Label steps, not time — see the chart memo. The ticks are the
                whole numbers on that scale, which is why they cannot come out
                unevenly spaced: they are evenly spaced by definition, and each
                one is the position of the reading it captions. */}
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, chart.xMax]}
              allowDataOverflow
              ticks={chart.ticks}
              tick={<AxisDateTick labels={chart.labels} />}
              interval={0}
              axisLine={false}
              tickLine={false}
              height={26}
            />
            {/* Labels are pinned to the chart's own right edge, which is the
                edge the toggles above and the panel's contents already line
                up on. Left to Recharts they hang short of it: the tick sits a
                fixed offset INTO its band and the text runs left-to-right
                from there, so the right end of the label lands wherever that
                label's own width happens to put it — 18px shy here, and a
                different amount again if the numbers gain a digit.
                Anchoring the text at its END and pushing it out by the band's
                width makes the label's right edge the fixed point instead, so
                it stays flush whatever the values read. */}
            {/* Fitted to the window's own readings and rounded outward to
                readable numbers — see niceValueDomain. A fixed grid of whole
                $10M steps was tried and cost the short ranges most of their
                amplitude: 7D's 22–28M sat inside a 20–30M scale, so the curve
                used barely half the height it had. */}
            <YAxis
              orientation="right"
              domain={[yLo, yHi]}
              ticks={yTicks}
              allowDataOverflow
              tickFormatter={usdCompact}
              tick={{
                fontSize: 10.5,
                fill: "#8b8580",
                fontFamily: "var(--font-mono)",
                textAnchor: "end",
                dx: Y_AXIS_W,
              }}
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_W}
              // interval={0} so every tick is drawn. Left to its default it
              // silently drops one when it thinks two labels might collide,
              // and the survivors then sit at uneven distances — $22.0M,
              // $27.5M, $33.0M, $44.0M, with $38.5M missing and a double gap
              // where it belonged.
              interval={0}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,.18)" }}
              contentStyle={{
                background: "#17171a",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                fontSize: 11,
                boxShadow: "0 14px 36px rgba(0,0,0,.55)",
              }}
              labelStyle={{ color: "#c9c4bd", marginBottom: 6 }}
              itemStyle={{ color: "#f5f3ee" }}
              // Read off the hovered reading's own timestamp rather than the
              // axis value, which is a label step and means nothing to anyone.
              labelFormatter={(_v, payload) => {
                const t = payload?.[0]?.payload?.t;
                if (typeof t !== "number") return "";
                return `${new Date(t).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}, ${new Date(t).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "UTC",
                })} UTC`;
              }}
              formatter={(value: number, name: string) => [
                `$${Math.round(value).toLocaleString("en-US")}`,
                name === "projected" ? "Projected" : "TVL",
              ]}
            />
            <Area
              type="natural"
              dataKey="tvl"
              stroke="url(#heroTvlLineFade)"
              strokeWidth={1.75}
              strokeLinecap="round"
              fill="url(#heroTvlFill)"
              connectNulls={false}
              // Marks sit on captioned days only — see TvlDot. Drawing every
              // reading turned a lag between snapshots into a pair of beads
              // glued to the nearer label (16 against 17, today's snapshot
              // against the live figure).
              dot={<TvlDot />}
              activeDot={{ r: 2.75, fill: CHART_GOLD, stroke: "#0b0b0c", strokeWidth: 1.4 }}
              // Entrance animation off, and not just for taste: Recharts
              // holds the dots back until the animation reports finished, and
              // that animation runs on requestAnimationFrame — which browsers
              // suspend in a background tab. Loaded in one, the curve drew but
              // the dots never appeared at all.
              isAnimationActive={false}
            />
            {withProjection && (
              <Line
                type="linear"
                dataKey="projected"
                stroke={CHART_GOLD}
                strokeWidth={1.15}
                strokeDasharray="5 4"
                strokeOpacity={0.5}
                dot={false}
                // Without this the whole projected stretch was dead to the
                // cursor: the TVL series has no points out there, so hovering
                // the right-hand ~18% of the plot produced no dot at all.
                activeDot={{ r: 2.75, fill: CHART_GOLD, stroke: "#0b0b0c", strokeWidth: 1.4 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
