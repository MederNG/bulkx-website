"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, Sector } from "recharts";
import type { OverviewDonutSegment } from "@/lib/overview-metrics";
import { cn } from "@/lib/utils";
import {
  MetricTableHeader,
  MetricTableRow,
  metricTableMinWidth,
  METRIC_TABLE_LEAD_INSET,
} from "@/components/overview/MetricTable";

/** How long the ring takes to wipe round on first draw. */
const SWEEP_MS = 900;
/** 12 o'clock, sweeping clockwise. */
const START_ANGLE = 90;
/** Ring radii as a fraction of the donut box's measured width rather than
 * fixed pixels — the box is sized by the surrounding layout, so deriving the
 * radii from it is what keeps the ring in proportion at any viewport instead
 * of only at the one a hardcoded radius was tuned for. */
const RING_OUTER_RATIO = 0.448;
const RING_INNER_RATIO = 0.284;
/** How far past outerRadius the hover glow's outermost ring reaches. The
 * radius is capped so this always stays inside the canvas — at small sizes
 * that cap, not the ratio above, is what limits the ring. */
const GLOW_HEADROOM = 12;
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

/** Just the hover glow — the centre text is an HTML overlay instead (see
 * below), which sidesteps SVG text-wrapping entirely. */
function renderActiveShape(rawProps: unknown) {
  const props = rawProps as ActiveShapeProps;
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#FFB547"
        strokeWidth={1.5}
        style={{ filter: "drop-shadow(0 0 5px rgba(255,181,71,0.45))" }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="rgba(255,181,71,0.22)"
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 10}
        outerRadius={outerRadius + 12}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="#FFB547"
        style={{ filter: "drop-shadow(0 0 6px rgba(255,181,71,0.55))" }}
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
}: {
  segments: OverviewDonutSegment[];
  totalAuraNumber: number;
  /** Overview keeps Share so the legend lines up with the tier table under
   * it. Aura sources already has a Category Share chart beside the donut. */
  showShare?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

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
  const width =
    avail.w === 0
      ? 0
      : Math.max(
          // The floor gives way to the row's own height — a short panel still
          // shrinks the ring rather than overflowing.
          Math.min(MIN_RING, avail.h),
          Math.min(
            avail.h,
            // The -1 is a rounding cushion. clientWidth is an integer while
            // the row's real width isn't, so a ring sized to the whole of it
            // can land a fraction of a px wide — enough for the legend's
            // label column to give up that fraction and stop lining up with
            // the tier table's Size column below.
            avail.w - avail.legendFloor - ROW_GAP - METRIC_TABLE_LEAD_INSET - 1
          )
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
      segments.map((s) => ({
        category: s.label,
        share: s.pct,
        points: s.points,
        color: s.color,
      })),
    [segments]
  );

  // A fast mouse-out or an alt-tab away mid-hover can skip the pointer past
  // Recharts' sector boundary without ever firing its onMouseLeave, leaving
  // the active slice highlighted indefinitely.
  useEffect(() => {
    if (activeIndex === undefined) return;
    const clear = () => setActiveIndex(undefined);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("mouseleave", clear);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("mouseleave", clear);
    };
  }, [activeIndex]);

  const active = activeIndex != null ? chartData[activeIndex] : undefined;

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
  // 0.16 is set from the widest value this shows: a ten-character grouped
  // number runs about 5.4x the font size, so 0.16 leaves roughly 15% of the
  // hole as clearance either side. A looser ratio hit the 20px cap and
  // stopped scaling while the hole kept shrinking, which is what let the
  // number reach the ring on a shorter viewport.
  const valueFontPx = Math.max(10, Math.min(20, holeDiameter * 0.16));
  // Capped at 10px to match the column headings in the legend beside it —
  // same size, same 0.1em tracking, same muted colour, so the two read as one
  // class of label rather than this one looking like fine print. It was
  // ceilinged at 9.5 and floored at 7, which on a normal-sized ring left it a
  // shade under everything else on the panel and hard to read at all.
  //
  // The ratio is generous enough that the cap is what binds at any ring this
  // panel actually draws; it only starts scaling down on a ring small enough
  // that 10px genuinely wouldn't fit the hole. "TOTAL AURA" needs 67px at
  // 10px against the 78px the hole gives at the tightest layout measured.
  const captionFontPx = Math.max(8.5, Math.min(10, holeDiameter * 0.13));

  const sourcesLayout = !showShare;

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 gap-5 overflow-hidden",
        sourcesLayout ? "items-start" : "items-center"
      )}
      // Holds the ring off the card's left edge, in step with the tier names
      // below it — see METRIC_TABLE_LEAD_INSET.
      style={{ paddingLeft: METRIC_TABLE_LEAD_INSET }}
      onMouseLeave={() => setActiveIndex(undefined)}
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
        className="relative shrink-0"
        style={
          width > 0
            ? {
                width,
                height: width,
                // Pulled left by the ring's own inset inside its square
                // canvas. The canvas is wider than the ring — it has to be,
                // to keep the hover glow from clipping — so aligning the BOX
                // with the tier bullets below left the visible ring sitting a
                // dozen px to their right. Offsetting by the inset lines up
                // what's actually drawn.
                marginLeft: -ringLeftInset,
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
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {chartData.map((row) => (
                <Cell key={row.category} fill={row.color} stroke="#141310" strokeWidth={1} />
              ))}
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
              className="m-0 truncate font-semibold leading-tight"
              style={{
                fontSize: valueFontPx,
                color: active ? active.color : "var(--color-text-primary)",
                maxWidth: "100%",
              }}
            >
              {Math.round(active ? active.points : totalAuraNumber).toLocaleString("en-US")}
            </p>
            <p
              className="m-0 mt-1 truncate uppercase leading-tight tracking-[0.1em] text-text-muted"
              style={{ fontSize: captionFontPx, maxWidth: "100%" }}
            >
              {active ? active.category : "Total Aura"}
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          sourcesLayout
            ? "flex-1 justify-start self-start"
            : "ml-auto flex-none self-stretch [justify-content:safe_center]"
        )}
        // Overview: fixed at legendFloor + ml-auto so Category/Aura/Share
        // line up with the tier table under the card. Aura sources: flex-1
        // so leftover beside the height-capped ring goes into the legend,
        // and self-start so a two-row week table stays at the top.
        style={
          sourcesLayout
            ? {
                minWidth: avail.legendFloor,
                maxWidth: "100%",
                // Same inset the ring has inside its square canvas, so the
                // header sits on the donut's apex rather than the box's top.
                paddingTop: ringLeftInset,
              }
            : { width: avail.legendFloor, minWidth: 0, maxWidth: "100%" }
        }
      >
        <MetricTableHeader
          columns={
            showShare ? (["Category", "Aura", "Share"] as const) : (["Category", "Aura"] as const)
          }
          wide={sourcesLayout}
        />
        {chartData.map((row, i) => (
          <MetricTableRow
            key={row.category}
            color={row.color}
            name={row.category}
            count={Math.round(row.points).toLocaleString("en-US")}
            share={showShare ? `${Math.round(row.share)}%` : undefined}
            wide={sourcesLayout}
            active={activeIndex === i}
            dimmed={activeIndex !== undefined && activeIndex !== i}
            isFirst={i === 0}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(undefined)}
          />
        ))}
      </div>
    </div>
  );
}
