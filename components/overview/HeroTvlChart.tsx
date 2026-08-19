"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Room held to the left of the first point so its date can be centred under
 * it like every other one — a label is 33px wide, so 20 is half of one with a
 * little to spare.
 *
 * Anchoring that label flush to the edge instead costs nothing in overflow but
 * shifts the text half its own width to the right of the point it belongs to,
 * which measures as a shorter gap to its neighbour — 22px shorter at both ends
 * of the full range, exactly the unevenness it was meant to prevent.
 *
 * The room is taken from the card's own padding rather than from the plot: the
 * wrapper below is pulled left by this same amount (-ml-5, matching PanelCard's
 * p-5), so the line still begins on the card's content edge, level with the
 * legend above it, and only the overhanging half of that first label sits in
 * the padding. The right side needs no equivalent — the y-axis band already
 * leaves more than this past the last tick. */
const X_LABEL_HALF_W = 20;

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
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

const DAY_MS = 86_400_000;

/** Room one "Aug 08" label needs before it starts touching its neighbour. The
 * text itself measures 44-49px depending on its digits, so this leaves at
 * least 9px of air between any two. */
const MIN_LABEL_SPACING_PX = 58;



/** A date label, centred on its own tick — except the very first, which starts
 * on it instead.
 *
 * The plot reserves X_LABEL_HALF_W on the left, which is exactly half a
 * label's width: room for a CENTRED label there without it running past the
 * card's content edge. It is not room to spare, though, so a centred first
 * label still spills into that reserve right up to the edge, which reads as
 * hanging off the chart rather than sitting under its first point. Starting
 * it on the tick instead keeps its text entirely to the right, flush with
 * where the curve itself begins. Every other label keeps the centred
 * treatment — the y-axis band gives the last one all the room it needs, and
 * the ones in between are never near an edge at all. */
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

  return (
    <text
      x={x}
      y={y + 12}
      textAnchor={payload.value === 0 ? "start" : "middle"}
      fill="var(--color-text-secondary)"
      fontSize={11}
      fontFamily="var(--font-ibm-plex-sans)"
    >
      {labels?.[payload.value] ?? ""}
    </text>
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

  // The travelling glint follows the line's own rendered shape exactly —
  // rather than approximating Recharts' curve math ourselves, this mirrors
  // the `d` of the actual stroke path Recharts already drew onto an overlay
  // path stacked on top of it.
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const pulseSvgRef = useRef<SVGSVGElement | null>(null);
  /** Plot width, used to keep the x-axis from asking for more date labels
   * than actually fit side by side. */
  const [wrapWidth, setWrapWidth] = useState(0);
  /** That width minus the y-axis gutter, the chart's right margin and the
   * left reserve — the strip the date labels actually have to share. */
  const labelStripWidth = Math.max(0, wrapWidth - Y_AXIS_W - 8 - X_LABEL_HALF_W);

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
   * two of them is placed proportionally by its timestamp inside that step.
   *
   * That inversion is what finally holds all four rules at once — a caption on
   * the first point and on the last, every caption under its own point, and
   * identical distance between them. On a time axis it cannot be done, and
   * every previous attempt here traded one rule for another: the readings are
   * a day apart but the newest is the live figure, read whenever the page was
   * opened, so its step came out 1.5 days wide and its caption sat 50px
   * further out than the rest; and a window that begins "seven days ago"
   * begins between two readings, so counting captions off from the end left
   * the first one 39px short of where the line starts. Neither is a rounding
   * error to be tuned away — they are what a time axis means. Laying the axis
   * out in label steps makes the spacing structural instead: tick j sits at
   * x = j because the reading it belongs to IS x = j.
   *
   * The cost is that the line is stretched slightly inside a step spanning
   * more time than its neighbours. With daily readings that is a fraction of a
   * day across ~60px, and it buys an axis that cannot come out uneven.
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

    const readings: { t: number; tvl: number | null; projected: number | null }[] = windowed.map(
      (p) => ({ t: p.t, tvl: p.tvl, projected: null })
    );

    // The live TVL is usually fresher than the last stored snapshot. Added as
    // its own reading at its own timestamp — writing it onto the last snapshot
    // instead would bend that snapshot to today's value and draw a vertical
    // cliff wherever the two disagree.
    const newest = readings[readings.length - 1];
    if (!newest || referenceTimeMs - newest.t > 60_000) {
      readings.push({ t: referenceTimeMs, tvl: currentTvl, projected: currentTvl });
    } else {
      newest.projected = newest.tvl;
    }

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

    // Rungs a caption may stand on: the first reading of each UTC day, so one
    // rung means one day whatever the snapshot cadence does. Where a day holds
    // several — the campaign's opening day has nine, hours apart — the extras
    // stay drawn but share their day's step, instead of each claiming one and
    // stretching that single day across a ninth of the chart.
    const rungIdx: number[] = [];
    const seenDays = new Set<number>();
    readings.forEach((r, idx) => {
      const day = Math.floor(r.t / DAY_MS);
      if (seenDays.has(day)) return;
      seenDays.add(day);
      rungIdx.push(idx);
    });

    // The newest reading closes the ladder, because the line ends on it and
    // the last point has to carry a date. If today already put a rung down,
    // the live reading takes it over rather than adding a second one.
    const lastIdx = readings.length - 1;
    const tail = rungIdx[rungIdx.length - 1];
    if (tail !== lastIdx) {
      if (Math.floor(readings[tail].t / DAY_MS) === Math.floor(readings[lastIdx].t / DAY_MS)) {
        rungIdx[rungIdx.length - 1] = lastIdx;
      } else {
        rungIdx.push(lastIdx);
      }
    }

    // How many steps the strip can hold, capped by how many rungs exist. Every
    // step is the same width by construction, so this is the only place the
    // available width enters the layout at all.
    const steps = Math.max(
      1,
      Math.min(rungIdx.length - 1, Math.floor(labelStripWidth / MIN_LABEL_SPACING_PX))
    );

    // Which rungs actually get captions, spread evenly along the ladder. The
    // rounding can leave one caption seven days from its neighbour and the
    // next eight — invisible, because both are one step and every step is the
    // same width. The ends are exact: j = 0 is the first reading, j = steps
    // the last.
    const captionAt = Array.from(
      { length: steps + 1 },
      (_, j) => rungIdx[Math.round((j * (rungIdx.length - 1)) / steps)]
    );

    // Everything between two captioned readings is placed by its timestamp
    // inside that step, so the shape of the line still follows real time; only
    // the width each step is given is fixed.
    const xs = new Array<number>(readings.length);
    for (let j = 0; j < steps; j++) {
      const a = captionAt[j];
      const b = captionAt[j + 1];
      const ta = readings[a].t;
      const tb = readings[b].t;
      for (let idx = a; idx <= b; idx++) {
        xs[idx] = tb > ta ? j + (readings[idx].t - ta) / (tb - ta) : j;
      }
    }

    const points: Point[] = readings.map((r, idx) => ({ x: xs[idx], ...r }));
    let xMax = steps;

    if (withProjection && projection.available) {
      // The forecast runs past the last reading. Placed on the same scale — a
      // step's worth of time to a step's worth of width — so it reads as a
      // continuation rather than a jump.
      const stepMs = (readings[lastIdx].t - readings[0].t) / steps;
      const x =
        stepMs > 0
          ? steps + (projection.nextSnapshotTimestamp - readings[lastIdx].t) / stepMs
          : steps;
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
      ticks: Array.from({ length: steps + 1 }, (_, j) => j),
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

    // Written straight to the DOM node rather than through React state. The
    // Area's entrance is JS-driven (react-smooth) and rewrites `d` every
    // frame, so routing each frame through a state update meant the overlay
    // rendered one frame behind the curve it was tracing — visible as the
    // glint hanging off the old shape while the line moved under it.
    const sync = () => {
      setWrapWidth(wrap.clientWidth);
      const layers = pulseSvgRef.current?.querySelectorAll<SVGPathElement>(".tvl-pulse-line");
      if (!layers?.length) return;
      const d = wrap
        .querySelector<SVGPathElement>(".recharts-area-curve")
        ?.getAttribute("d");
      layers.forEach((dst) => {
        if (d) {
          if (dst.getAttribute("d") !== d) dst.setAttribute("d", d);
          dst.style.visibility = "";
        } else {
          // No curve drawn at all (empty range) — hide rather than leave a
          // stale shape floating over an empty chart.
          dst.style.visibility = "hidden";
        }
      });
    };

    sync();

    // A MutationObserver rather than a timer or rAF loop: it fires on the
    // very mutation that changes `d`, in the same tick and before paint, so
    // the clone is never even one frame stale. It also needs no dependency
    // on `data` — a range switch reaches us as the same attribute mutation
    // that any other reshape does. (rAF would have been wrong here anyway:
    // browsers suspend it entirely in a backgrounded tab, the reason this
    // glint previously failed to appear at all until the tab was focused.)
    const mo = new MutationObserver(sync);
    mo.observe(wrap, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["d"],
    });

    const ro = new ResizeObserver(sync);
    ro.observe(wrap);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
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
        <div className="flex shrink-0 gap-1.5" style={{ width: TVL_TOGGLE_GROUP_W }}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeRange(r)}
              className={cn(
                "flex-1 px-2.5 py-[3px] text-[11px]",
                // The transparent border on the active pill is load-bearing:
                // .ghost-pill carries a 1px border and .cta doesn't, and
                // with flex-basis:0 under border-box each button's base size
                // is its own padding plus border — so without this the
                // selected pill came out 2px narrower than the two beside it.
                r === range
                  ? "cta border border-transparent font-medium"
                  : "ghost-pill cursor-pointer"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-text-muted">
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

      {/* Pulled left by the card's padding and given that same amount back as
          the plot's left margin, so the two cancel: the line starts on the
          card's content edge, level with the legend above it, while the first
          date label still has room to sit centred under its own point. Without
          the pull the plot began X_LABEL_HALF_W short of that edge; without the
          margin the label would be clipped by this wrapper's overflow. */}
      <div ref={chartWrapRef} className="relative mt-2 -ml-5 min-h-0 flex-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%" minHeight={90}>
          <ComposedChart
            data={data}
            // Cancels the wrapper's -ml-5 — see the comment on it above.
            margin={{ top: 6, right: 8, bottom: 0, left: X_LABEL_HALF_W }}
          >
            <defs>
              <linearGradient id="heroTvlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,181,71,0.30)" />
                <stop offset="100%" stopColor="rgba(255,181,71,0)" />
              </linearGradient>
              {/* Softly fades the line's own opacity toward both ends —
                  objectBoundingBox coordinates, so 0%/100% track the line's
                  own left/right extent regardless of the visible range. */}
              <linearGradient id="heroTvlLineFade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffb547" stopOpacity={0} />
                <stop offset="7%" stopColor="#ffb547" stopOpacity={1} />
                <stop offset="93%" stopColor="#ffb547" stopOpacity={1} />
                <stop offset="100%" stopColor="#ffb547" stopOpacity={0} />
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
                fontFamily: "var(--font-ibm-plex-sans)",
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
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="url(#heroTvlFill)"
              connectNulls={false}
              // Real readings marked, so a stretch with none is visible as
              // one. Snapshots can lag — the set currently jumps from Aug 12
              // straight to the live point — and drawn as a bare line that
              // gap looks like ordinary data you simply can't hover. With the
              // points marked it reads correctly: there is nothing in
              // between. Suppressed past ~40 points, where per-point dots
              // turn into a solid beaded line and stop meaning anything.
              dot={
                data.length <= 40
                  ? { r: 2.4, fill: "#ffb547", stroke: "#0b0b0c", strokeWidth: 1.5 }
                  : false
              }
              activeDot={{ r: 4, fill: "#ffb547", stroke: "#0b0b0c", strokeWidth: 2 }}
              // Entrance animation off, and not just for taste: Recharts
              // holds the dots back until the animation reports finished, and
              // that animation runs on requestAnimationFrame — which browsers
              // suspend in a background tab. Loaded in one, the curve drew but
              // the dots never appeared at all. Same rAF trap the donuts and
              // the shimmer already had to avoid.
              isAnimationActive={false}
            />
            {withProjection && (
              <Line
                type="linear"
                dataKey="projected"
                stroke="#ffb547"
                strokeWidth={1.6}
                strokeDasharray="6 4"
                strokeOpacity={0.55}
                dot={false}
                // Without this the whole projected stretch was dead to the
                // cursor: the TVL series has no points out there, so hovering
                // the right-hand ~18% of the plot produced no dot at all.
                activeDot={{ r: 4, fill: "#ffb547", stroke: "#0b0b0c", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Always mounted, its `d` filled in by the effect above — gating the
            element on state would mean unmounting and remounting it on every
            reshape, which restarts the CSS animation from zero each time. */}
        <svg
          ref={pulseSvgRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            {/* Coordinates are fractions of the path's own bounding box, so
                the sweep spans the visible line at any range without needing
                a pixel width. x1/x2 move together, keeping the band a
                constant 0.3 of the width; SMIL rather than CSS because CSS
                cannot animate gradient coordinates. */}
            <linearGradient id="tvlShimmer" x1="-0.3" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffb547" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff3d6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffb547" stopOpacity="0" />
              <animate
                attributeName="x1"
                values="-0.3;1"
                dur="7s"
                repeatCount="indefinite"
              />
              <animate attributeName="x2" values="0;1.3" dur="7s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
          <path
            fill="none"
            stroke="url(#tvlShimmer)"
            className="tvl-pulse-line"
            style={{ visibility: "hidden" }}
          />
        </svg>
      </div>
    </div>
  );
}
