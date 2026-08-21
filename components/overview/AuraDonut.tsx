"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, Sector } from "recharts";
import type { OverviewDonutSegment } from "@/lib/overview-metrics";
import { CHART_GOLD, chartPrimaryRamp } from "@/lib/overview-metrics";
import { cn } from "@/lib/utils";
import { useNarrowViewport } from "@/lib/use-narrow-viewport";
import {
  MetricTableHeader,
  MetricTableRow,
  metricTableMinWidth,
  METRIC_TABLE_LEAD_INSET,
} from "@/components/overview/MetricTable";

function compactAura(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString("en-US");
}
const SWEEP_MS = 900;
/** 12 o'clock, sweeping clockwise. */
const START_ANGLE = 90;
/** Ring radii as a fraction of the donut box's measured width rather than
 * fixed pixels — the box is sized by the surrounding layout, so deriving the
 * radii from it is what keeps the ring in proportion at any viewport instead
 * of only at the one a hardcoded radius was tuned for. */
const RING_OUTER_RATIO = 0.45;
/** Thinner band than before — leaves a larger hole so the centre figure
 * can sit in proportion with the ring instead of floating in empty space. */
const RING_INNER_RATIO = 0.398;
/** Room so sector strokes never clip the canvas edge. */
const GLOW_HEADROOM = 6;
/** Square well the Aura analytics page gives the ring, so every group
 * (Overview / Retro / Week N) draws at the same size. Exported so the
 * Category Share chart can share that well and sit on the same top edge. */
export const AURA_SOURCES_DONUT_WELL = 320;

/** Distance from the well's top to the ring's apex — the legend and the
 * bar chart both pad by this so they meet the donut rather than the box. */
export function donutApexInset(well = AURA_SOURCES_DONUT_WELL): number {
  const outerRadius = Math.max(0, Math.min(well * RING_OUTER_RATIO, well / 2 - GLOW_HEADROOM));
  return well / 2 - outerRadius;
}

/** Floor under the ring. Without one it is the only thing in the row sized
 * from the leftover, so on a narrow layout it absorbed the entire shortfall
 * and rendered at 42px — a ring too small to read next to a legend that had
 * taken everything. Below this the legend's own columns give way instead. */
const MIN_RING = 120;
/** Matches the `gap-5` on the row below (20px). */
const ROW_GAP = 20;

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

/**
 * Room-light hover: base sector stays put so the ring never punches a black
 * hole; gold only fades in/out on top — on = lights up, off = lights out.
 */
function renderActiveShape(rawProps: unknown, lit: boolean, baseFill: string) {
  const props = rawProps as ActiveShapeProps;
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={baseFill}
        stroke="var(--color-bulk-base)"
        strokeWidth={1}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={CHART_GOLD}
        stroke="none"
        style={{
          opacity: lit ? 1 : 0,
          transition: "opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </g>
  );
}

interface DonutRow {
  category: string;
  share: number;
  points: number;
  color: string;
}

/**
 * Aura-by-source ring — the same Recharts donut the Aura Sources page uses,
 * so both views share one sweep-in animation and hover treatment.
 */
export function AuraDonut({
  segments,
  totalAuraNumber,
  showShare = true,
  hoverIndex: hoverIndexProp,
  onHoverIndexChange,
}: {
  segments: OverviewDonutSegment[];
  totalAuraNumber: number;
  /** Overview keeps Share so the legend lines up with the tier table under
   * it. Aura sources already has a Category Share chart beside the donut. */
  showShare?: boolean;
  /** Controlled hover — Aura sources shares this with Category Share so a
   * legend row, a bar, or a Y-label all light the same slice. */
  hoverIndex?: number | undefined;
  onHoverIndexChange?: (index: number | undefined) => void;
}) {
  const [localHover, setLocalHover] = useState<number | undefined>(undefined);
  const controlled = onHoverIndexChange != null;
  const hoverIndex = controlled ? hoverIndexProp : localHover;
  const setHoverIndex = controlled ? onHoverIndexChange! : setLocalHover;
  /** Sector kept under activeShape while opacity eases out after leave. */
  const [paintIndex, setPaintIndex] = useState<number | undefined>(undefined);
  const [activeVisible, setActiveVisible] = useState(false);
  const narrow = useNarrowViewport();
  const closeTimer = useRef(0);
  const openRef = useRef(false);

  useEffect(() => {
    window.clearTimeout(closeTimer.current);

    if (hoverIndex != null) {
      const alreadyOpen = openRef.current;
      setPaintIndex(hoverIndex);
      if (alreadyOpen) {
        openRef.current = true;
        setActiveVisible(true);
        return;
      }
      openRef.current = true;
      setActiveVisible(false);
      let cancelled = false;
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setActiveVisible(true);
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    }

    openRef.current = false;
    setActiveVisible(false);
    closeTimer.current = window.setTimeout(() => {
      setPaintIndex(undefined);
    }, 520);
    return () => window.clearTimeout(closeTimer.current);
  }, [hoverIndex]);

  // Measured off the ROW, not the donut's own box, and against both axes.
  // The ring is square, so its size is bounded by whichever of the two runs
  // out first — sizing it from width alone (as this did) drew a 248px ring
  // into whatever height the panel had left, which overflowed the card and
  // pushed the ring up over the countdown line above it. Measured rather
  // than handed to ResponsiveContainer because this card can mount while a
  // FLIP swap still has it scaled down, and ResponsiveContainer latches that
  // transformed size permanently; `clientWidth`/`clientHeight` report layout
  // size, which a transform can't skew.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0, legendFloor: 0 });

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    // The legend floor moves with the viewport, since the gap between its
    // columns does — so it's read here, alongside the row's own size, rather
    // than baked in as a constant.
    const measure = () =>
      setAvail({
        w: el.clientWidth,
        h: el.clientHeight,
        legendFloor: metricTableMinWidth(window.innerWidth, { share: showShare }),
      });
    measure();

    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);

    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [showShare]);

  // The row is [inset][ring][gap][legend]; the ring gets whatever width is
  // left once the fixed-width legend, the gap and the row's own left inset
  // are taken out, capped only by the available height. The inset has to
  // come out by hand: clientWidth counts padding, so without this the ring
  // would be sized as if the inset weren't there.
  //
  // There used to be an additional MAX_RING ceiling (248px) here too, "so the
  // ring stayed in proportion with the legend" even in a tall, wide panel.
  // What that actually did was leave the ring capped well below what this
  // formula already computed for it — 248 against a formula result of 319 at
  // 1920 — while the legend's own box (below) is flex-1 and still stretched
  // to fill the row regardless, so the width the ring gave up did not go to
  // the legend either: it sat as a gap belonging to neither, 105px of it at
  // 1920. Removing the cap is what lets the ring actually claim the width
  // this formula was already handing it.
  const leftover =
    avail.w === 0
      ? 0
      : avail.w - avail.legendFloor - ROW_GAP - METRIC_TABLE_LEAD_INSET - 1;
  const stacked = narrow || (avail.w > 0 && leftover < MIN_RING);

  const width =
    avail.w === 0
      ? 0
      : stacked
        ? Math.max(MIN_RING, Math.min(avail.w, 242))
        : Math.max(
          Math.min(MIN_RING, avail.h),
          Math.min(avail.h, leftover)
        );

  // Recharts' own entrance runs through react-smooth, which ticks on
  // requestAnimationFrame and was observed leaving sectors with no rendered
  // path at all here. So the sweep is driven manually instead: `endAngle` is
  // stepped from the start angle round to a full turn on a plain timer, and
  // Recharts redraws the arcs each step. Same clockwise wipe as the built-in
  // load animation, without the rAF dependency.
  const [sweep, setSweep] = useState(0);
  const sweptRef = useRef(false);

  // Keyed on "has the row been measured yet", not on the measurement itself.
  // Depending on `width` meant any resize mid-sweep tore the effect down —
  // the cleanup cancelled the timer, and the re-run bailed straight back out
  // on `sweptRef`, which had already latched. The sweep then stayed frozen at
  // whatever it had reached, and at 0 that is an `endAngle` equal to the start
  // angle: sectors of no length at all, so the ring never appeared while the
  // centre readout (a plain HTML overlay) carried on showing the total.
  const measured = width > 0;

  useEffect(() => {
    if (!measured || sweptRef.current) return;
    sweptRef.current = true;

    let timer = 0;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / SWEEP_MS);
      setSweep(1 - Math.pow(1 - t, 3)); // ease-out
      if (t < 1) timer = window.setTimeout(step, 16);
    };
    timer = window.setTimeout(step, 30);

    return () => window.clearTimeout(timer);
  }, [measured]);

  const chartData = useMemo<DonutRow[]>(
    () =>
      segments.map((s, i) => ({
        category: s.label,
        share: s.pct,
        points: s.points,
        // Prefer the colour the caller already assigned (primary ramp) so the
        // ring matches its legend / companion chart.
        color: s.color || chartPrimaryRamp(i, segments.length),
      })),
    [segments]
  );

  // A fast mouse-out or an alt-tab away mid-hover can skip the pointer past
  // Recharts' sector boundary without ever firing its onMouseLeave, leaving
  // the active slice highlighted indefinitely.
  useEffect(() => {
    if (hoverIndex === undefined) return;
    const clear = () => setHoverIndex(undefined);
    // Controlled hover is owned by the parent row — don't clear on window
    // blur from here or the Category Share sync drops mid-drag.
    if (controlled) return;
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("mouseleave", clear);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("mouseleave", clear);
    };
  }, [hoverIndex, controlled, setHoverIndex]);

  const active = hoverIndex != null ? chartData[hoverIndex] : undefined;
  /** Hovering a non-primary slice: gold leaves the primary mark and that
   * slice takes it — Overview donut transfer. */
  const borrowColor =
    hoverIndex != null && hoverIndex > 0 ? chartData[hoverIndex].color : null;
  const primaryIdle = borrowColor == null;

  // Radii, and everything sized against them, derived from the measured
  // canvas. The cap keeps the hover glow inside the canvas; without it the
  // outermost glow ring would be clipped once the panel got short enough to
  // shrink the donut.
  // Floored at 0: before the row has been measured `width` is 0, and the
  // glow headroom alone would take the radius negative — which then read as
  // an inset the size of the headroom and put a margin on the box while it
  // had no geometry at all.
  const outerRadius = Math.max(
    0,
    Math.min(width * RING_OUTER_RATIO, width / 2 - GLOW_HEADROOM)
  );
  const innerRadius = outerRadius * (RING_INNER_RATIO / RING_OUTER_RATIO);
  /** Distance from the canvas's left edge to the ring's — the ring is
   * centred in a square box that is deliberately larger than it. */
  const ringLeftInset = width / 2 - outerRadius;
  // The centre readout scales with the hole it sits in. It used to be a
  // fixed 18px, which fits a full-size donut but runs out over the ring as
  // soon as a shorter viewport shrinks the ring around it. Capped at the
  // top so it doesn't balloon on a tall panel, and floored so it stays
  // legible on a short one.
  const holeDiameter = innerRadius * 2;
  // Grouped ten-digit values run ~5.4× the font size; ~0.19 of the hole
  // keeps ~15% clearance either side. Cap is high enough that the figure
  // actually fills a normal Overview hole (the old 20px ceiling left it
  // stranded in the middle of a ~200px opening).
  const tightHole = holeDiameter > 0 && holeDiameter < 96;
  const valueFontPx = Math.max(11, Math.min(28, holeDiameter * (tightHole ? 0.22 : 0.19)));
  const captionFontPx = Math.max(8.5, Math.min(11, holeDiameter * 0.055));

  const sourcesLayout = !showShare;

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1",
        stacked ? "flex-col items-stretch gap-3 overflow-visible" : "gap-5 overflow-hidden",
        !stacked && (sourcesLayout ? "items-start" : "items-center")
      )}
      style={{ paddingLeft: stacked ? 0 : METRIC_TABLE_LEAD_INSET }}
      onMouseLeave={() => {
        if (!controlled) setHoverIndex(undefined);
      }}
    >
      {/* Sized from the measurement above rather than by a width class, so
          the ring shrinks to fit a short panel instead of spilling out of
          it. The radii are ratios of this same number, so they follow. */}
      {/* No inline geometry until the row has actually been measured. These
          values all derive from `width`, which is 0 for the server render and
          for the client's first paint, so emitting them early gives React two
          descriptions of the same box to reconcile — a hydration mismatch,
          which it refuses to patch up. Withheld as one unit, both sides
          render the same bare div and the geometry arrives with the measure. */}
      <div
        className={cn("relative shrink-0", stacked && "mx-auto")}
        style={
          width > 0
            ? {
                width,
                height: width,
                marginLeft: stacked ? undefined : -ringLeftInset,
              }
            : undefined
        }
      >
        {width > 0 && (
          <PieChart width={width} height={width}>
            <Pie
              data={chartData}
              dataKey="share"
              nameKey="category"
              cx="50%"
              cy="50%"
              // Ratios of the measured box rather than fixed pixels, so the
              // ring can never outgrow its box on a narrow viewport — it
              // stays correctly sized at every width instead of only at the
              // one a hardcoded radius would have been tuned for.
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              startAngle={START_ANGLE}
              endAngle={START_ANGLE - 360 * sweep}
              // Scaled with the sweep rather than switched on at the end:
              // snapping them to full size on the last step visibly squeezed
              // every sector to make room, then let it spring back.
              minAngle={5 * sweep}
              paddingAngle={(chartData.length > 5 ? 1 : 2) * sweep}
              isAnimationActive={false}
              activeIndex={paintIndex}
              activeShape={(props) =>
                renderActiveShape(
                  props,
                  activeVisible,
                  paintIndex != null ? chartData[paintIndex].color : CHART_GOLD
                )
              }
              onMouseEnter={(_, i) => setHoverIndex(i)}
              onMouseLeave={() => {
                if (!controlled) setHoverIndex(undefined);
              }}
            >
              {chartData.map((row, i) => {
                const isPrimary = i === 0;
                // Gold stays on the primary at rest; on a secondary hover it
                // borrows that slice's slate so the gold can move over.
                const fill =
                  isPrimary && borrowColor != null
                    ? borrowColor
                    : isPrimary
                      ? CHART_GOLD
                      : row.color;
                return (
                  <Cell
                    key={row.category}
                    fill={fill}
                    stroke="var(--color-bulk-base)"
                    strokeWidth={1}
                    opacity={
                      hoverIndex == null ||
                      hoverIndex === i ||
                      (isPrimary && borrowColor != null)
                        ? 1
                        : 0.5
                    }
                    className={isPrimary && primaryIdle ? "chart-gold-pulse" : undefined}
                    style={{ transition: "opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), fill 0.5s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        )}

        {/* Constrained to the hole rather than the whole canvas, so a long
            value or a long category name is bounded by the space it actually
            has instead of running out over the ring. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div
            className="flex flex-col items-center"
            style={{ width: holeDiameter ? holeDiameter * 0.92 : undefined }}
          >
            <p
              className="font-figure m-0 truncate font-semibold leading-tight"
              style={{
                fontSize: valueFontPx,
                color: active ? CHART_GOLD : "var(--color-text-primary)",
                maxWidth: "100%",
              }}
            >
              {tightHole
                ? compactAura(active ? active.points : totalAuraNumber)
                : Math.round(active ? active.points : totalAuraNumber).toLocaleString("en-US")}
            </p>
            <p
              className={cn(
                "font-label m-0 mt-0.5 leading-tight text-text-muted",
                tightHole ? "whitespace-normal" : "truncate"
              )}
              style={{ fontSize: captionFontPx, maxWidth: "100%" }}
            >
              {active ? active.category : tightHole ? "Aura" : "Total Aura"}
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          stacked || sourcesLayout
            ? "flex-1 justify-start self-stretch"
            : "ml-auto flex-none self-stretch [justify-content:safe_center]"
        )}
        style={
          stacked
            ? { width: "100%", minWidth: 0, maxWidth: "100%", paddingTop: 0 }
            : sourcesLayout
              ? {
                  minWidth: avail.legendFloor,
                  maxWidth: "100%",
                  // Same constant the Category Share chart uses, so CATEGORY /
                  // AURA sit on the donut apex even when the measured ring
                  // inset drifts with leftover width.
                  paddingTop: donutApexInset(AURA_SOURCES_DONUT_WELL),
                }
              : { width: avail.legendFloor, minWidth: 0, maxWidth: "100%" }
        }
      >
        <MetricTableHeader
          columns={
            showShare ? (["Category", "Aura", "Share"] as const) : (["Category", "Aura"] as const)
          }
          wide={sourcesLayout || stacked}
        />
        {chartData.map((row, i) => {
          const legendColor =
            hoverIndex === i
              ? CHART_GOLD
              : i === 0 && borrowColor
                ? borrowColor
                : row.color;
          return (
            <MetricTableRow
              key={row.category}
              color={legendColor}
              pulseDot={i === 0 && primaryIdle}
              name={row.category}
              count={Math.round(row.points).toLocaleString("en-US")}
              share={showShare ? `${Math.round(row.share)}%` : undefined}
              wide={sourcesLayout || stacked}
              active={hoverIndex === i}
              dimmed={
                hoverIndex !== undefined &&
                hoverIndex !== i &&
                !(i === 0 && borrowColor != null)
              }
              isFirst={i === 0}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => {
                if (!controlled) setHoverIndex(undefined);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
