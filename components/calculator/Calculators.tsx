"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FDV_SCENARIOS, cn, formatNumber, formatUsd } from "@/lib/utils";
import { useNarrowViewport } from "@/lib/use-narrow-viewport";
import { APR_TOTAL_AURA_SUPPLY } from "@/lib/overview-metrics";
import { computeFdv } from "@/lib/percentiles";
import {
  predictDepositAura,
  type DepositAuraPredictContext,
  type DepositPredictMode,
} from "@/lib/deposit-aura-predict";
import { useLiveFinancials } from "@/components/live/LiveFinancialProvider";
import { formatRemainingDuration } from "@/lib/projected-snapshot-tvl";
import { Select } from "@/components/ui/Select";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { PanelCard, PanelLabel } from "@/components/overview/PanelCard";
import { PageHeading } from "@/components/layout/PageHeading";
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const FDV_FIELD_INFO = {
  yourAura:
    "Total AURA your wallet has earned (or a target amount to model). Use Wallet Lookup or your leaderboard total.",
  fdv: "Fully Diluted Valuation — token price × fully diluted supply (as if all tokens were unlocked). Not market cap, which uses circulating supply only. Enter your scenario in M (millions) or B (billions).",
  allocation:
    "Portion of the total token supply allocated to the airdrop in your scenario.",
  totalSupply:
    "Assumed AURA in the airdrop pool at distribution — the number your FDV scenario is divided by. Live campaign total is only what has been earned so far and will keep growing. Overview APR models 60M.",
  poolValue:
    "Token Price × Allocation (%) — airdrop market cap (Token Price = FDV ÷ 1B). Edit to set a target; FDV, Aura Value, and Your Value update.",
} as const;

/** Cents, in full, with separators. formatUsd compacts anything past a
 * thousand — fine for a table cell, wrong for the single figure this page is
 * built around, where "$6.5K" hides the very digits being modelled. */
function formatUsdExact(value: number): string {
  return (
    "$" +
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/**
 * FDV at a fractional position along the scenario list — position 0 is the
 * first scenario, 1 the second, and 2.5 halfway between the third and fourth.
 *
 * Straight lines between the scenarios are what put the corners in the curve:
 * the steps run 150, 250, 250, 250, then 1000, so the slope quadruples in one
 * place and the eye reads a hinge. This is a monotone cubic (Fritsch-Carlson)
 * through the same six points — it keeps every one of them exactly, never
 * doubles back or overshoots the way a plain cubic would, and hands the
 * segments matching slopes where they meet, which is what turns the hinge into
 * a bend.
 *
 * The slopes are computed on the whole list rather than per call; sampling is
 * the only per-point work.
 */
function monotoneSlopes(values: readonly number[]): number[] {
  const n = values.length;
  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i++) deltas.push(values[i + 1] - values[i]);

  const slopes: number[] = new Array(n);
  slopes[0] = deltas[0];
  slopes[n - 1] = deltas[n - 2];
  for (let i = 1; i < n - 1; i++) {
    // Harmonic mean of the neighbouring steps: it leans towards the smaller of
    // the two, which is what stops a long step from dragging the curve past
    // the point it is meant to pass through.
    slopes[i] =
      deltas[i - 1] * deltas[i] <= 0
        ? 0
        : (2 * deltas[i - 1] * deltas[i]) / (deltas[i - 1] + deltas[i]);
  }

  // Fritsch-Carlson limiter — the step that makes it monotone rather than
  // merely smooth.
  for (let i = 0; i < n - 1; i++) {
    if (deltas[i] === 0) {
      slopes[i] = 0;
      slopes[i + 1] = 0;
      continue;
    }
    const a = slopes[i] / deltas[i];
    const b = slopes[i + 1] / deltas[i];
    const magnitude = a * a + b * b;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      slopes[i] = scale * a * deltas[i];
      slopes[i + 1] = scale * b * deltas[i];
    }
  }
  return slopes;
}

const FDV_SLOPES = monotoneSlopes(FDV_SCENARIOS);

function fdvAtPosition(position: number): number {
  const last = FDV_SCENARIOS.length - 1;
  const i = Math.min(Math.max(Math.floor(position), 0), last - 1);
  const t = position - i;
  const t2 = t * t;
  const t3 = t2 * t;
  // Cubic Hermite basis.
  return (
    (2 * t3 - 3 * t2 + 1) * FDV_SCENARIOS[i] +
    (t3 - 2 * t2 + t) * FDV_SLOPES[i] +
    (-2 * t3 + 3 * t2) * FDV_SCENARIOS[i + 1] +
    (t3 - t2) * FDV_SLOPES[i + 1]
  );
}

/** Stops laid between each neighbouring pair of scenarios — per interval, not
 * across the whole range. That distinction is the axis: subdividing each
 * interval equally keeps every scenario an equal number of stops from the next
 * one, so the six ticks stay evenly spaced across the plot. Subdividing the
 * range as a whole would have spaced the stops by value instead, which drags
 * $100M-$500M into the left quarter and spreads $1000M-$2000M across half the
 * width.
 *
 * High enough that the cursor slides rather than steps, low enough that the
 * whole series is trivial arithmetic on every keystroke in the FDV box. */
const FDV_STEPS_PER_SEGMENT = 24;

/** Millions up to a billion, then "$1B" / "$2B". Four-digit millions are the
 * point where the unit stops helping: "$2000M" has to be counted, "$2B" is
 * read.
 *
 * One formatter for every place an FDV is written — the axis ticks and the
 * scenario rows — so the same number can never be spelled two ways on one
 * screen. */
function fdvTick(value: number): string {
  if (value >= 1_000_000_000) {
    const billions = value / 1_000_000_000;
    return "$" + (Number.isInteger(billions) ? billions : billions.toFixed(1)) + "B";
  }
  return "$" + Math.round(value / 1_000_000) + "M";
}

function niceUsdStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalised = rough / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Four-or-so round dollar levels from $0 to just above the curve's peak. */
function usdAxisTicks(max: number): { hi: number; ticks: number[] } {
  const step = niceUsdStep(Math.max(max, 1) / 4);
  const hi = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= hi + step / 2; v += step) ticks.push(v);
  return { hi, ticks };
}

function formatAxisUsd(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return "$" + (Number.isInteger(m) ? m : m.toFixed(1)) + "M";
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return "$" + (Number.isInteger(k) ? k : k.toFixed(1)) + "K";
  }
  return "$" + Math.round(value);
}

const FDV_Y_AXIS_W = 52;

/**
 * Axis label that hugs the plot's edges instead of overhanging them.
 *
 * Recharts centres every tick on its own gridline, so the first and last —
 * sitting on the very edges — spill half their width outside the plot. The fix
 * was margins wide enough to catch the overhang, but that pulled the curve in
 * from both sides and left it stopping short of the card. Anchoring the outer
 * two labels to their inside edge instead lets the plot run the full width and
 * the curve reach the card's edge.
 */
function FdvAxisTick({
  x,
  y,
  payload,
  index,
  visibleTicksCount,
  fontSize = 12,
}: {
  x?: number;
  y?: number;
  payload?: { value?: number };
  index?: number;
  visibleTicksCount?: number;
  fontSize?: number;
}) {
  const isFirst = index === 0;
  const isLast = visibleTicksCount != null && index === visibleTicksCount - 1;
  return (
    <text
      x={x}
      y={y}
      dy={14}
      textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
      fill="var(--color-text-primary)"
      fontSize={fontSize}
      fontFamily="var(--font-ibm-plex-sans)"
    >
      {fdvTick(payload?.value ?? 0)}
    </text>
  );
}

/** Right-axis dollars. Lives in a gutter to the right of the plot so the
 * labels never sit on the curve, and end-anchors on the gutter's right —
 * the same x as Airdrop market cap in the header. */
function FdvYAxisTick({
  x,
  y,
  payload,
  index,
}: {
  x?: number;
  y?: number;
  payload?: { value?: number };
  index?: number;
}) {
  const isBottom = index === 0;
  return (
    <text
      x={x}
      y={y}
      dx={FDV_Y_AXIS_W - 2}
      dy={isBottom ? -6 : 4}
      textAnchor="end"
      fill="var(--color-text-primary)"
      fontSize={12}
      fontFamily="var(--font-ibm-plex-sans)"
    >
      {formatAxisUsd(payload?.value ?? 0)}
    </text>
  );
}

/** The page's two tools, as one control. Same sliding-pill toggle the
 * Overview panels use for Current/Projected and Count/Value: a control that
 * swaps what the panel below it shows looks the same everywhere on the site. */
const TOOL_TABS = [
  { id: "estimator", label: "Airdrop Estimator" },
  { id: "predictor", label: "Aura Predictor" },
] as const;

type ToolTab = (typeof TOOL_TABS)[number]["id"];
type SupplyPreset = "live" | "assumed" | "custom";

export function CalculatorSection({ totalAuraSupply = 0 }: { totalAuraSupply?: number }) {
  const { depositPredict, totalAura } = useLiveFinancials();
  const liveSupply = Math.round(totalAura || totalAuraSupply);
  const [tab, setTab] = useState<ToolTab>("estimator");
  // Bumped on every click and used as the underline's key. Keying on the tab
  // alone only restarted the mark when the tab actually changed, so clicking
  // the one already open — the natural way to ask "which am I on?" — answered
  // with nothing.
  const [tabClickCount, setTabClickCount] = useState(0);
  const [userAura, setUserAura] = useState(500);
  const [fdv, setFdv] = useState(500_000_000);
  const [allocation, setAllocation] = useState(30);
  // 60M, not the live earned-so-far figure: this card models a future drop,
  // and the campaign total is still a fraction of the assumed pool.
  const [supplyPreset, setSupplyPreset] = useState<SupplyPreset>("assumed");
  const [auraSupply, setAuraSupply] = useState(APR_TOTAL_AURA_SUPPLY);

  useEffect(() => {
    if (supplyPreset === "live") setAuraSupply(liveSupply);
  }, [supplyPreset, liveSupply]);

  const result = useMemo(
    () => computeFdv(userAura, fdv, allocation, auraSupply),
    [userAura, fdv, allocation, auraSupply]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The tabs go inside the heading card rather than under it. They pick
          which tool the page is, which is the heading's own question — and as
          a separate strip they were a second bar of chrome between the title
          and the work.

          Underlined tabs rather than a pill, and the same 2px accent rule the
          site nav marks its active section with: switching between two whole
          views is the nav's kind of move, not a panel control's. The pill
          stays where it belongs — Count/Value and Current/Projected swap a
          series inside one panel, a smaller thing than changing what the page
          is showing.

          No border under the row any more: inside the card that line ran a
          few pixels above the card's own bottom edge and read as a seam. */}
      <PageHeading eyebrow="Tools" title="Calculators & estimators" centered>
      <div className="flex flex-wrap items-center justify-center gap-7">
        {TOOL_TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setTabClickCount((n) => n + 1);
              }}
              aria-pressed={on}
              className={cn(
                "relative cursor-pointer pb-2.5 text-[13px] font-medium transition-colors",
                on ? "text-accent" : "text-text-muted hover:text-text-primary"
              )}
            >
              {t.label}
              {on && (
                // Keyed on the click count so every press remounts it and
                // the animation restarts. It replaced a layoutId slide: with
                // the line gone a second later there is nothing left to slide,
                // and the two behaviours fought over the same element.
                //
                // A gradient rather than a flat bar: squared-off ends made a
                // 2px rule read as a hard underscore stuck to the label, where
                // ends that fade let it sit under the word instead.
                <span
                  key={tabClickCount}
                  className="switch-underline pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[linear-gradient(90deg,transparent_0%,var(--color-accent)_22%,var(--color-accent)_78%,transparent_100%)]"
                />
              )}
            </button>
          );
        })}
      </div>
      </PageHeading>

      {tab === "estimator" ? (
        <EstimatorWorkbench
          userAura={userAura}
          setUserAura={setUserAura}
          fdv={fdv}
          setFdv={setFdv}
          allocation={allocation}
          setAllocation={setAllocation}
          auraSupply={auraSupply}
          setAuraSupply={(v) => {
            setSupplyPreset("custom");
            setAuraSupply(v);
          }}
          liveSupply={liveSupply}
          supplyPreset={supplyPreset}
          onSupplyPreset={(preset) => {
            setSupplyPreset(preset);
            setAuraSupply(preset === "live" ? liveSupply : APR_TOTAL_AURA_SUPPLY);
          }}
          result={result}
        />
      ) : (
        <DepositAuraPredictor context={depositPredict} />
      )}
    </div>
  );
}

function EstimatorWorkbench({
  userAura,
  setUserAura,
  fdv,
  setFdv,
  allocation,
  setAllocation,
  auraSupply,
  setAuraSupply,
  liveSupply,
  supplyPreset,
  onSupplyPreset,
  result,
}: {
  userAura: number;
  setUserAura: (v: number) => void;
  fdv: number;
  setFdv: (v: number) => void;
  allocation: number;
  setAllocation: (v: number) => void;
  auraSupply: number;
  setAuraSupply: (v: number) => void;
  liveSupply: number;
  supplyPreset: SupplyPreset;
  onSupplyPreset: (preset: Exclude<SupplyPreset, "custom">) => void;
  result: { poolValue: number; auraValue: number; userValue: number };
}) {
  const applyFdvFromDerived = (nextFdv: number) => {
    setFdv(Number.isFinite(nextFdv) && nextFdv >= 0 ? nextFdv : 0);
  };
  const setMarketCap = (marketCap: number) => {
    if (allocation <= 0) return;
    applyFdvFromDerived(marketCap / (allocation / 100));
  };
  return (
    <>
      {/* 1fr / 2fr: the inputs column is a stack of single fields and needs
          only its own width, while the chart and the scenario table are the
          two things that actually improve with more of it. */}
      {/* No items-start: the two stretch to the taller of them, so the
          inputs card ends level with the chart beside it rather than stopping
          short and leaving a step in the row. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <PanelCard glossy glossDelay={-16}>
          {/* Label then fields, with no band wrapper around them: the
              wrapper carried its own top padding, which sat this label a row
              below the chart card's beside it even though both cards start at
              the same y. */}
          <PanelLabel>Your inputs</PanelLabel>
          <div className="mt-3">
            {/* Your Aura with Allocation, FDV with Airdrop Market Cap — the
                two pairs that belong together. Total Aura Supply is the
                scenario's own assumption about the future pool, so it takes
                the full row rather than sharing one. */}
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:items-start">
              <Field
                label="Your Aura"
                info={FDV_FIELD_INFO.yourAura}
                value={userAura}
                onChange={setUserAura}
              />
              <Field
                label="Allocation"
                info={FDV_FIELD_INFO.allocation}
                value={allocation}
                onChange={setAllocation}
                max={100}
                suffix={<span className="text-[13px] text-text-secondary">%</span>}
              />
              <FdvField fdv={fdv} onFdvChange={setFdv} info={FDV_FIELD_INFO.fdv} />
              <EditableMoneyBox
                label="Airdrop Market Cap"
                info={FDV_FIELD_INFO.poolValue}
                value={result.poolValue}
                onChange={setMarketCap}
              />
              <div className="min-w-0 sm:col-span-2">
                <div className="mb-1">
                  <FieldLabel label="Total Aura Supply" info={FDV_FIELD_INFO.totalSupply} />
                </div>
                <CompoundInput
                  trailing={
                    <SupplyPresetToggle preset={supplyPreset} onPreset={onSupplyPreset} />
                  }
                >
                  <NumericInput
                    value={auraSupply}
                    onChange={setAuraSupply}
                    step={100_000}
                    className="min-w-0 flex-1 bg-transparent px-[0.875rem] py-[0.625rem] text-sm tabular-nums outline-none"
                  />
                </CompoundInput>
              </div>
            </div>
          </div>
        </PanelCard>

        <FdvValueChart
          userAura={userAura}
          fdv={fdv}
          allocation={allocation}
          auraSupply={auraSupply}
          result={result}
        />
      </div>

      {/* Full width, below both columns rather than stacked under the chart.
          Pairing the inputs off two at a time left that card barely taller
          than the chart beside it, and the matrix — kept in the right-hand
          column — walled off the space under the inputs as a blank square.
          Across the whole row it fills that space and its four columns get
          the room to spread out besides. */}
      <FdvScenarioPanel
        userAura={userAura}
        fdv={fdv}
        allocation={allocation}
        auraSupply={auraSupply}
        currentValue={result.userValue}
      />
    </>
  );
}

/** The scenario curve, plus wherever the FDV box currently sits on it.
 *
 * Spaced by position rather than by value: the six scenarios run 100M to
 * 2000M, so a true numeric axis crushes the first four into the left fifth of
 * the chart and the reading everyone actually wants — how the payout steps
 * from one scenario to the next — disappears into a corner. Even spacing
 * costs the curve its literal straightness (value is linear in FDV) and buys
 * six legible steps.
 *
 * The live FDV is spliced into the series rather than snapped to the nearest
 * scenario, so a typed 637M puts the marker between $500M and $750M where it
 * belongs; its tick is suppressed so the axis keeps its six round numbers. */
function FdvValueChart({
  userAura,
  fdv,
  allocation,
  auraSupply,
  result,
}: {
  userAura: number;
  fdv: number;
  allocation: number;
  auraSupply: number;
  result: { poolValue: number; auraValue: number; userValue: number };
}) {
  // One point per scenario is six stops for the cursor to jump between; this
  // fills the gaps so the readout slides instead of stepping. The axis is
  // unaffected — it is told explicitly to label the six scenarios and nothing
  // else, so a hundred data points still produce six ticks.
  //
  // Keyed on the number rather than on its formatted label: two nearby steps
  // can round to the same "$120M" string, and duplicate categories collapse
  // into one another on the axis.
  const data = useMemo(() => {
    const stops: number[] = [];
    for (let i = 0; i < FDV_SCENARIOS.length - 1; i++) {
      for (let step = 0; step < FDV_STEPS_PER_SEGMENT; step++) {
        stops.push(Math.round(fdvAtPosition(i + step / FDV_STEPS_PER_SEGMENT)));
      }
    }
    stops.push(FDV_SCENARIOS[FDV_SCENARIOS.length - 1]);
    return stops.map((f) => {
      const at = computeFdv(userAura, f, allocation, auraSupply);
      return {
        fdv: f,
        value: at.userValue,
        auraValue: at.auraValue,
        poolValue: at.poolValue,
      };
    });
  }, [userAura, allocation, auraSupply]);

  // The beacon snaps to the nearest stop rather than the typed FDV getting a
  // stop of its own: an extra point inserted mid-grid would push every
  // scenario after it off the even spacing the axis depends on. The grid is
  // fine enough that the nearest stop is within a few million. Null when the
  // FDV box is outside the scenario range — there is no curve out there to
  // stand on.
  const beacon = useMemo(() => {
    if (fdv < data[0].fdv || fdv > data[data.length - 1].fdv) return null;
    return data.reduce((best, point) =>
      Math.abs(point.fdv - fdv) < Math.abs(best.fdv - fdv) ? point : best
    );
  }, [data, fdv]);

  // Hovering the curve previews a scenario. All three figures switch, not
  // just the payout: they are one reading of a single FDV, and leaving the
  // two on the right showing the typed-in FDV while the headline showed the
  // hovered one would put two different scenarios side by side as if they
  // belonged together.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hovered = hoveredIndex != null ? (data[hoveredIndex] ?? null) : null;
  const shownValue = hovered ? hovered.value : result.userValue;
  const shownAuraValue = hovered ? hovered.auraValue : result.auraValue;
  const shownPoolValue = hovered ? hovered.poolValue : result.poolValue;

  const yMax = data.reduce((m, d) => Math.max(m, d.value), 0);
  const { hi: yHi, ticks: yTicks } = usdAxisTicks(yMax);
  const narrow = useNarrowViewport();
  const xTicks = narrow
    ? [100_000_000, 500_000_000, 1_000_000_000, 2_000_000_000]
    : [...FDV_SCENARIOS];

  const scenarioPoints = useMemo(
    () =>
      FDV_SCENARIOS.map((f) => ({
        fdv: f,
        value: computeFdv(userAura, f, allocation, auraSupply).userValue,
      })),
    [userAura, allocation, auraSupply]
  );

  return (
    <PanelCard glossy glossDelay={-11}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <PanelLabel>Your Airdrop Value</PanelLabel>
          <p className="m-0 mt-2 truncate text-[clamp(24px,3vw,34px)] font-semibold leading-none tracking-[-0.02em] text-accent">
            {formatUsdExact(shownValue)}
          </p>
        </div>
        {/* Read-only here on purpose — the editable copies of both live in
            RESULTS on the left, and two edit points for one number invites
            the reader to wonder which one is the real one. */}
        <div className="flex shrink-0 items-start gap-4 border-l border-[var(--color-line)] pl-4 sm:gap-6 sm:pl-6">
          <div className="text-right">
            <PanelLabel>Price per Aura</PanelLabel>
            <p className="m-0 mt-1.5 text-[12px] font-semibold tabular-nums text-accent">
              ${shownAuraValue.toFixed(4)}
            </p>
          </div>
          <div className="text-right">
            <PanelLabel>Airdrop market cap</PanelLabel>
            <p className="m-0 mt-1.5 text-[12px] font-semibold tabular-nums text-accent">
              {formatUsd(shownPoolValue)}
            </p>
          </div>
        </div>
      </div>

      <div className="fdv-chart mt-4 h-[214px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 0, bottom: 24, left: 0 }}
            onMouseMove={(state) => {
              const index = (state as { activeTooltipIndex?: number } | undefined)
                ?.activeTooltipIndex;
              setHoveredIndex(typeof index === "number" ? index : null);
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="fdv-curve-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb547" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#ffb547" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fdv-curve-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffb547" stopOpacity={0} />
                <stop offset="7%" stopColor="#ffb547" stopOpacity={1} />
                <stop offset="93%" stopColor="#ffb547" stopOpacity={1} />
                <stop offset="100%" stopColor="#ffb547" stopOpacity={0} />
              </linearGradient>
            </defs>
            {yTicks.map((y) => (
              <ReferenceLine
                key={`h-${y}`}
                y={y}
                stroke="rgba(198, 182, 186, 0.16)"
                strokeDasharray="3 3"
              />
            ))}
            {FDV_SCENARIOS.map((f) => (
              <ReferenceLine
                key={`v-${f}`}
                x={f}
                stroke="rgba(198, 182, 186, 0.12)"
                strokeDasharray="3 3"
              />
            ))}
            <XAxis
              dataKey="fdv"
              ticks={xTicks}
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={(props) => <FdvAxisTick {...props} fontSize={narrow ? 10 : 12} />}
              tickMargin={10}
            />
            <YAxis
              orientation="right"
              domain={[0, yHi]}
              ticks={yTicks}
              interval={0}
              tick={<FdvYAxisTick />}
              axisLine={false}
              tickLine={false}
              tickSize={0}
              tickMargin={0}
              width={FDV_Y_AXIS_W}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
              content={() => null}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#fdv-curve-stroke)"
              strokeWidth={2}
              fill="url(#fdv-curve-fill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{
                r: 5,
                fill: "var(--color-bulk-base)",
                stroke: "#ffb547",
                strokeWidth: 2,
              }}
            />
            {scenarioPoints.map((point) => (
              <ReferenceDot
                key={`scen-${point.fdv}`}
                x={point.fdv}
                y={point.value}
                r={2.5}
                fill="#ffb547"
                stroke="#0b0b0c"
                strokeWidth={1.5}
              />
            ))}
            {beacon && (
              <ReferenceDot
                x={beacon.fdv}
                y={beacon.value}
                r={3.5}
                fill="#ffb547"
                stroke="none"
                className="chart-beacon"
                isFront
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </PanelCard>
  );
}

/** Every scenario as a row, with the live one picked out and each other one
 * quoted against it. The old table showed the same three numbers with no
 * anchor, which left "is $750M much better than $500M?" to mental arithmetic
 * — vs. Current answers it directly. */
function FdvScenarioPanel({
  userAura,
  fdv,
  allocation,
  auraSupply,
  currentValue,
}: {
  userAura: number;
  fdv: number;
  allocation: number;
  auraSupply: number;
  currentValue: number;
}) {
  const rows = FDV_SCENARIOS.map((scenario) => {
    const { userValue, auraValue } = computeFdv(userAura, scenario, allocation, auraSupply);
    const delta = currentValue > 0 ? (userValue / currentValue - 1) * 100 : 0;
    return {
      key: fdvTick(scenario),
      isCurrent: scenario === fdv,
      auraValue: "$" + auraValue.toFixed(4),
      userValue: formatUsd(userValue),
      delta,
    };
  });

  return (
    <PanelCard glossy glossDelay={-6}>
      <PanelLabel>FDV scenario matrix</PanelLabel>

      <div className="mt-4">
        {/* Same shape as the Overview tables: a 10px uppercase heading row on
            a hairline, then fixed-height rows divided by the softer one, first
            column left, every number right. */}
        <div className="grid grid-cols-4 items-center gap-x-2 border-b border-[var(--color-line)] pb-1.5 sm:gap-x-8">
          <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">
            <span className="sm:hidden">FDV</span>
            <span className="hidden sm:inline">FDV (millions USD)</span>
          </span>
          <span className="text-right text-[10px] uppercase tracking-[0.1em] text-text-muted">
            <span className="sm:hidden">Price</span>
            <span className="hidden sm:inline">Price per Aura</span>
          </span>
          <span className="text-right text-[10px] uppercase tracking-[0.1em] text-text-muted">
            <span className="sm:hidden">Value</span>
            <span className="hidden sm:inline">Your Value</span>
          </span>
          <span className="text-right text-[10px] uppercase tracking-[0.1em] text-text-muted">
            <span className="sm:hidden">vs now</span>
            <span className="hidden sm:inline">vs. Current</span>
          </span>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.key}
            className={cn(
              "grid grid-cols-4 items-center gap-x-2 sm:gap-x-8",
              i > 0 && "border-t border-[var(--color-line-soft)]",
              "cursor-default transition-colors",
              // Only the cursor tints a row now. The live row is marked by its
              // text turning gold instead: a band that jumped between rows on
              // every keystroke in the FDV box was the most moving thing on
              // the page, for the one row the reader already knows they typed.
              "hover:bg-[rgba(255,255,255,0.04)]"
            )}
            style={{ height: 42 }}
          >
            <span
              className={cn(
                "truncate text-[13px] font-medium tabular-nums",
                row.isCurrent ? "text-accent" : "text-text-primary"
              )}
            >
              {row.key}
            </span>
            <span
              className={cn(
                "text-right text-[13px] tabular-nums",
                row.isCurrent ? "text-accent" : "text-text-secondary"
              )}
            >
              {row.auraValue}
            </span>
            <span
              className={cn(
                "text-right text-[13px] font-semibold tabular-nums",
                row.isCurrent ? "text-accent" : "text-text-primary"
              )}
            >
              {row.userValue}
            </span>
            <span
              className={cn(
                "text-right text-[13px] font-medium tabular-nums",
                row.isCurrent
                  ? "text-accent"
                  : row.delta >= 0
                    ? "text-bid-green"
                    : "text-[var(--color-neg-strong)]"
              )}
            >
              {row.isCurrent
                ? "—"
                : (row.delta >= 0 ? "+" : "−") + Math.abs(row.delta).toFixed(0) + "%"}
            </span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

function formatUsdHours(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

export function DepositAuraPredictor({
  context,
}: {
  context: DepositAuraPredictContext;
}) {
  const [deposit, setDeposit] = useState(1_000);
  const [mode, setMode] = useState<DepositPredictMode | null>("new_deposit");
  const [holdSinceWeek, setHoldSinceWeek] = useState<number | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const result = useMemo(
    () =>
      predictDepositAura(
        deposit,
        {
          depositPool: context.depositPool,
          cohortUsdHoursAtSnapshot: context.cohortUsdHoursAtSnapshot,
          hoursUntilSnapshot: context.hoursUntilSnapshot,
          hoursInWeek: context.hoursInWeek,
          campaignWeek: context.campaignWeek,
          weekTvl: context.weekTvl,
          weekPool: context.weekPool,
          weekEligibleCumUsdHours: context.weekEligibleCumUsdHours,
          eligibleCumUsdHoursAtSnapshot: context.eligibleCumUsdHoursAtSnapshot,
        },
        {
          mode: mode ?? undefined,
          holdSinceWeek,
        }
      ),
    [deposit, context, mode, holdSinceWeek]
  );

  const holdSinceActive = holdSinceWeek != null;
  const timeUntilSnapshot = formatRemainingDuration(context.hoursUntilSnapshot * 3_600_000);

  const campaignBars = useMemo(
    () =>
      predictDepositAura(
        deposit,
        {
          depositPool: context.depositPool,
          cohortUsdHoursAtSnapshot: context.cohortUsdHoursAtSnapshot,
          hoursUntilSnapshot: context.hoursUntilSnapshot,
          hoursInWeek: context.hoursInWeek,
          campaignWeek: context.campaignWeek,
          weekTvl: context.weekTvl,
          weekPool: context.weekPool,
          weekEligibleCumUsdHours: context.weekEligibleCumUsdHours,
          eligibleCumUsdHoursAtSnapshot: context.eligibleCumUsdHoursAtSnapshot,
        },
        { holdSinceWeek: 1 }
      ).weekBreakdown ?? [],
    [deposit, context]
  );

  const bars = useMemo(() => {
    const counted = new Map((result.weekBreakdown ?? []).map((row) => [row.week, row]));
    const campaign = new Map(campaignBars.map((row) => [row.week, row]));
    const selectedStart = holdSinceWeek ?? context.campaignWeek;

    return Array.from({ length: context.campaignWeek }, (_, i) => i + 1).map((week) => {
      const selected = week >= selectedStart;
      const inProgress = week === context.campaignWeek;
      const countedRow = counted.get(week);
      const campaignRow = campaign.get(week);
      let aura = campaignRow?.aura ?? 0;
      if (countedRow) aura = countedRow.aura;
      else if (!holdSinceActive && inProgress) aura = result.predictedAura;
      return { week, aura, inProgress, selected };
    });
  }, [
    result.weekBreakdown,
    result.predictedAura,
    campaignBars,
    holdSinceWeek,
    holdSinceActive,
    context.campaignWeek,
  ]);

  const holdSinceOptions = Array.from({ length: context.campaignWeek }, (_, i) => i + 1);
  const hovered = bars.find((bar) => bar.week === hoveredWeek) ?? null;
  const shownAura = hovered?.aura ?? result.predictedAura;
  const shownCaption = hovered
    ? hovered.inProgress
      ? `Week ${hovered.week} · ${timeUntilSnapshot} left`
      : `Week ${hovered.week}`
    : holdSinceActive
      ? "Predicted total Aura"
      : "Predicted deposit Aura";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <PanelCard glossy glossDelay={-16}>
        <PanelLabel>Aura Predictor</PanelLabel>
        <div className="mt-3 flex flex-1 flex-col">
          <div className="mb-3">
            <div className="mb-1">
              <FieldLabel label="Hold scenario" />
            </div>
            <SegmentToggle
              value={holdSinceActive ? "" : mode ?? "new_deposit"}
              onChange={(v) => {
                if (!v) return;
                setHoldSinceWeek(null);
                setMode(v as DepositPredictMode);
              }}
              options={[
                { value: "new_deposit", label: "Deposit now" },
                { value: "full_week_hold", label: "Full week hold" },
              ]}
            />
          </div>

          <div className="mb-3">
            <div className="mb-1">
              <FieldLabel label="Hold since" />
            </div>
            <Select
              value={holdSinceWeek != null ? String(holdSinceWeek) : ""}
              onChange={(v) => {
                if (v) {
                  setMode(null);
                  setHoldSinceWeek(Number(v));
                  return;
                }
                setHoldSinceWeek(null);
                setMode("new_deposit");
              }}
              options={[
                { value: "", label: "Not set" },
                ...holdSinceOptions.map((week) => ({
                  value: String(week),
                  label: `Week ${week}`,
                })),
              ]}
            />
          </div>

          <Field label="Deposit Amount ($)" value={deposit} onChange={setDeposit} step={100} />
        </div>
      </PanelCard>

      <PanelCard glossy glossDelay={-11}>
        <PanelLabel>Projection</PanelLabel>
        <p className="m-0 mt-3 text-[clamp(28px,3.2vw,44px)] font-semibold leading-none tracking-[-0.02em] text-accent tabular-nums">
          {formatNumber(Math.round(shownAura))}
        </p>
        <p className="m-0 mt-2 text-[11px] uppercase tracking-[0.11em] text-text-muted">
          {shownCaption}
        </p>

        <div className="mt-4 h-px w-full bg-[var(--color-line)]" />
        <div className="grid grid-cols-2 divide-x divide-[var(--color-line)]">
          <div className="min-w-0 px-2 py-3 text-center">
            <p className="m-0 text-[11px] uppercase tracking-[0.11em] text-text-muted">
              Efficiency
            </p>
            <p className="m-0 mt-1.5 truncate text-[13px] font-semibold leading-none tabular-nums">
              {result.efficiency.toFixed(4)} A/$
            </p>
          </div>
          <div className="min-w-0 px-2 py-3 text-center">
            <p className="m-0 text-[11px] uppercase tracking-[0.11em] text-text-muted">
              {holdSinceActive ? "Lifetime USD-hours" : "Your USD-hours"}
            </p>
            <p className="m-0 mt-1.5 truncate text-[13px] font-semibold leading-none tabular-nums">
              {formatUsdHours(result.userUsdHours)}
            </p>
          </div>
        </div>

        <PredictorWeekBars bars={bars} hovered={hoveredWeek} onHover={setHoveredWeek} />
        <PoolShareTrack pct={result.poolSharePct} />
      </PanelCard>
    </div>
  );
}

function PredictorWeekBars({
  bars,
  hovered,
  onHover,
}: {
  bars: { week: number; aura: number; inProgress: boolean; selected: boolean }[];
  hovered: number | null;
  onHover: (week: number | null) => void;
}) {
  const selectedMax = Math.max(
    ...bars.filter((bar) => bar.selected).map((bar) => bar.aura),
    1
  );

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[148px] flex-1">
        <div
          className="absolute inset-0 flex items-stretch gap-[3px]"
          onMouseLeave={() => onHover(null)}
        >
        {bars.map((bar) => {
          const active = hovered === bar.week;
          const pulsing = bar.selected && bar.inProgress && (hovered == null || active);
          return (
            <div
              key={bar.week}
              className="flex flex-1 cursor-default flex-col items-stretch"
              onMouseEnter={() => onHover(bar.week)}
              role="img"
              aria-label={`Week ${bar.week}: ${Math.round(bar.aura)} Aura`}
            >
              <div className="flex min-h-0 flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-[2px] transition-[height,background-color] duration-500 ease-in-out",
                    pulsing && "apr-week-pulse",
                    hovered != null && !active && "opacity-45"
                  )}
                  style={{
                    height: bar.selected
                      ? `${Math.max(8, (bar.aura / selectedMax) * 100)}%`
                      : "8%",
                    background: active || bar.selected ? "#ffb547" : "rgba(255,181,71,0.32)",
                  }}
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {bars.map((bar) => (
          <div
            key={bar.week}
            className={cn(
              "min-w-0 flex-1 text-center text-[10px] leading-none tabular-nums sm:text-[11px]",
              bar.selected ? "text-accent" : "text-text-muted"
            )}
          >
            W{bar.week}
          </div>
        ))}
      </div>
    </div>
  );
}

function PoolShareTrack({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const label = pct < 0.01 ? `${pct.toFixed(4)}%` : `${pct.toFixed(2)}%`;

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-[11px] uppercase tracking-[0.11em] text-text-muted">Your slice</p>
        <p className="m-0 text-[13px] tabular-nums text-text-secondary">{label}</p>
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(255,181,71,0.12)]">
        <span
          className="absolute top-0 h-full w-[3px] rounded-full bg-accent"
          style={{ left: `min(calc(100% - 3px), ${clamped}%)` }}
        />
      </div>
    </div>
  );
}

function SegmentToggle({
  value,
  onChange,
  options,
  disabled,
  allowDeselect,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  allowDeselect?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex rounded-[10px] border border-[var(--color-line-strong)] bg-[var(--color-bulk-base)] p-0.5",
        disabled && "pointer-events-none opacity-45"
      )}
    >
      {options.map(({ value: optionValue, label }, i) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue || `${label}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (allowDeselect && selected) {
                onChange("");
                return;
              }
              onChange(optionValue);
            }}
            aria-pressed={selected}
            className={cn(
              "relative min-w-0 flex-1 rounded-md px-2 py-[0.5rem] text-[13px] font-medium transition-colors",
              selected
                ? "text-[var(--color-bulk-base)]"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {selected && (
              <motion.span
                layoutId="predictor-hold-toggle"
                className="absolute inset-0 rounded-md bg-accent"
                transition={{ type: "spring", stiffness: 480, damping: 32 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({
  label,
  info,
  hint,
}: {
  label: string;
  info?: string;
  hint?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="text-xs text-text-secondary">{label}</span>
      {hint ? <span className="truncate text-[11px] text-text-muted">{hint}</span> : null}
      {info ? <InfoTooltip text={info} floating panelClassName="w-64" /> : null}
    </span>
  );
}

/** Same sliding-pill shell as Overview's Count/Value — scaled to sit inside
 * an input, or next to a field label. Distinct layoutIds so two of these on
 * one card don't animate toward each other. */
function PillToggle<T extends string>({
  value,
  options,
  onChange,
  layoutId,
}: {
  value: T | null;
  options: readonly { id: T; label: string; title?: string }[];
  onChange: (id: T) => void;
  layoutId: string;
}) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-md border border-[var(--color-line-strong)] p-0.5">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={on}
            title={option.title}
            className={cn(
              "relative rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
              on
                ? "text-[var(--color-bulk-base)]"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded bg-accent"
                transition={{ type: "spring", stiffness: 480, damping: 32 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SupplyPresetToggle({
  preset,
  onPreset,
}: {
  preset: SupplyPreset;
  onPreset: (preset: Exclude<SupplyPreset, "custom">) => void;
}) {
  const assumedLabel = `${APR_TOTAL_AURA_SUPPLY / 1_000_000}M`;
  return (
    <PillToggle
      value={preset === "custom" ? null : preset}
      options={[
        { id: "live" as const, label: "Live", title: "Use earned-so-far campaign total" },
        { id: "assumed" as const, label: assumedLabel, title: `Assumed pool of ${assumedLabel}` },
      ]}
      onChange={onPreset}
      layoutId="supply-preset-toggle"
    />
  );
}

/** Input chrome that can host a trailing control — % or M/B — without a
 * second column eating width from fields that have nothing to put there. */
function CompoundInput({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing: React.ReactNode;
}) {
  return (
    <div className="flex items-center rounded-[10px] border border-[var(--color-line-strong)] bg-[var(--color-bulk-base)] transition-[border-color] duration-150 focus-within:border-accent">
      {children}
      <div className="shrink-0 pr-1.5">{trailing}</div>
    </div>
  );
}

function Field({
  label,
  info,
  value,
  onChange,
  step,
  max,
  disabled,
  suffix,
}: {
  label?: string;
  info?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  disabled?: boolean;
  /** Unit inside the box, on the right — a percent sign. */
  suffix?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      {label && (
        <div className="mb-1">
          <FieldLabel label={label} info={info} />
        </div>
      )}
      <div className="relative">
        <NumericInput
          value={value}
          onChange={onChange}
          step={step}
          max={max}
          disabled={disabled}
          className={cn(
            "input-field min-w-0 tabular-nums disabled:opacity-50",
            suffix && "pr-8"
          )}
        />
        {suffix && (
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

type FdvUnit = "M" | "B";

function fdvUnitCaption(unit: FdvUnit): string {
  return unit === "B" ? "billions USD" : "millions USD";
}

const FDV_UNIT_MULTIPLIER: Record<FdvUnit, number> = {
  M: 1_000_000,
  B: 1_000_000_000,
};

function formatCommaNumber(value: number, maxFractionDigits = 0): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatCommaInput(raw: string, maxFractionDigits = 6): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return cleaned;

  const [intPart = "", decPart] = cleaned.split(".");
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  const withCommas = normalizedInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (cleaned.includes(".")) {
    return `${withCommas}.${(decPart ?? "").slice(0, maxFractionDigits)}`;
  }
  return withCommas;
}

function parseCommaNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function restoreCommaCursor(el: HTMLInputElement, formatted: string, digitsBefore: number) {
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < digitsBefore) {
    if (/[\d.]/.test(formatted[pos]!)) seen += 1;
    pos += 1;
  }
  el.setSelectionRange(pos, pos);
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatFdvUnitDisplay(unitValue: number): string {
  return formatCommaNumber(Math.max(0, roundToHundredths(unitValue)), 2);
}

function formatFdvDisplay(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return formatCommaNumber(rounded, 3);
}

function resolveFdvUnit(absoluteFdv: number): FdvUnit {
  return absoluteFdv >= 1_000_000_000 ? "B" : "M";
}

function FdvField({
  fdv,
  onFdvChange,
  info,
}: {
  fdv: number;
  onFdvChange: (v: number) => void;
  info?: string;
}) {
  const [unit, setUnit] = useState<FdvUnit>(() => resolveFdvUnit(fdv));
  const [draft, setDraft] = useState(() =>
    formatFdvUnitDisplay(fdv / FDV_UNIT_MULTIPLIER[resolveFdvUnit(fdv)])
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused) return;
    const nextUnit = resolveFdvUnit(fdv);
    setUnit(nextUnit);
    setDraft(formatFdvUnitDisplay(fdv / FDV_UNIT_MULTIPLIER[nextUnit]));
  }, [fdv, isFocused]);

  const applyAbsoluteFdv = (absolute: number, syncDraft = true) => {
    const safe = Math.max(0, absolute);
    const nextUnit = resolveFdvUnit(safe);
    const unitValue = roundToHundredths(safe / FDV_UNIT_MULTIPLIER[nextUnit]);
    const snapped = unitValue * FDV_UNIT_MULTIPLIER[nextUnit];
    setUnit(nextUnit);
    if (syncDraft) setDraft(formatFdvUnitDisplay(unitValue));
    onFdvChange(snapped);
    return { nextUnit, unitValue, snapped };
  };

  const commitDraft = (nextDraft: string, nextUnit: FdvUnit = unit) => {
    const trimmed = nextDraft.trim();
    if (trimmed === "" || trimmed === ".") {
      applyAbsoluteFdv(0);
      return;
    }
    const parsed = parseCommaNumber(trimmed);
    if (parsed == null) return;
    applyAbsoluteFdv(roundToHundredths(parsed) * FDV_UNIT_MULTIPLIER[nextUnit]);
  };

  const selectUnit = (nextUnit: FdvUnit) => {
    if (nextUnit === unit) return;
    if (isFocused && draft.trim() !== "") {
      commitDraft(draft, nextUnit);
      return;
    }
    setUnit(nextUnit);
    setDraft(formatFdvUnitDisplay(fdv / FDV_UNIT_MULTIPLIER[nextUnit]));
  };

  return (
    <div className="relative min-w-0">
      <div className="mb-1">
        <FieldLabel label="FDV" info={info} hint={fdvUnitCaption(unit)} />
      </div>
      <CompoundInput
        trailing={
          <PillToggle
            value={unit}
            options={[
              { id: "M" as const, label: "M", title: "Millions" },
              { id: "B" as const, label: "B", title: "Billions" },
            ]}
            onChange={selectUnit}
            layoutId="fdv-unit-toggle"
          />
        }
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "" || draft.trim() === ".") {
              applyAbsoluteFdv(0);
              return;
            }
            commitDraft(draft);
          }}
          onChange={(e) => {
            const input = e.target;
            const nextRaw = input.value;
            if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

            const cursor = input.selectionStart ?? nextRaw.length;
            const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
            const formatted = formatCommaInput(nextRaw, 2);
            setDraft(formatted);

            const parsed = parseCommaNumber(formatted);
            if (parsed != null) {
              const { nextUnit, unitValue } = applyAbsoluteFdv(
                roundToHundredths(parsed) * FDV_UNIT_MULTIPLIER[unit],
                false
              );
              if (nextUnit !== unit) {
                const display = formatFdvUnitDisplay(unitValue);
                setDraft(display);
                requestAnimationFrame(() => {
                  const el = inputRef.current;
                  if (!el) return;
                  el.setSelectionRange(display.length, display.length);
                });
                return;
              }
            }

            requestAnimationFrame(() => {
              if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
            });
          }}
          className="min-w-0 flex-1 bg-transparent px-[0.875rem] py-[0.625rem] text-sm tabular-nums outline-none"
        />
      </CompoundInput>
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  className,
  step,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  step?: number;
  max?: number;
  disabled?: boolean;
}) {
  const maxFractionDigits =
    typeof step === "number" && step > 0 && step < 1
      ? Math.min(6, Math.ceil(-Math.log10(step)))
      : 0;
  const [draft, setDraft] = useState(() => formatCommaNumber(value, maxFractionDigits));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatCommaNumber(value, maxFractionDigits));
    }
  }, [value, isFocused, maxFractionDigits]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        if (draft.trim() === "" || draft.trim() === ".") {
          setDraft("0");
          onChange(0);
          return;
        }
        const parsed = parseCommaNumber(draft);
        if (parsed == null) return;
        const next = typeof max === "number" ? Math.min(parsed, max) : parsed;
        onChange(next);
        setDraft(formatCommaNumber(next, maxFractionDigits));
      }}
      onChange={(e) => {
        const input = e.target;
        const nextRaw = input.value;
        if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

        const cursor = input.selectionStart ?? nextRaw.length;
        const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
        const formatted = formatCommaInput(nextRaw, Math.max(maxFractionDigits, 6));
        setDraft(formatted);

        const parsed = parseCommaNumber(formatted);
        if (parsed != null) {
          onChange(typeof max === "number" ? Math.min(parsed, max) : parsed);
        }

        requestAnimationFrame(() => {
          if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
        });
      }}
      className={className}
    />
  );
}

function pickUsdUnit(value: number): FdvUnit {
  return value >= 1_000_000_000 ? "B" : "M";
}

function EditableMoneyBox({
  label,
  info,
  value,
  onChange,
  accent,
}: {
  label: string;
  info?: string;
  value: number;
  onChange: (v: number) => void;
  accent?: boolean;
}) {
  const [unit, setUnit] = useState<FdvUnit>(() => pickUsdUnit(value));
  const [draft, setDraft] = useState(() =>
    formatFdvDisplay(value / FDV_UNIT_MULTIPLIER[pickUsdUnit(value)])
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused) return;
    const nextUnit = pickUsdUnit(value);
    setUnit(nextUnit);
    setDraft(formatFdvDisplay(value / FDV_UNIT_MULTIPLIER[nextUnit]));
  }, [value, isFocused]);

  const applyValue = (next: number) => {
    if (!Number.isFinite(next) || next < 0) return;
    onChange(next);
  };

  const commitDraft = (nextDraft: string, nextUnit: FdvUnit = unit) => {
    const trimmed = nextDraft.trim();
    if (trimmed === "" || trimmed === ".") {
      applyValue(0);
      return;
    }
    const parsed = parseCommaNumber(trimmed);
    if (parsed == null) return;
    applyValue(parsed * FDV_UNIT_MULTIPLIER[nextUnit]);
  };

  const selectUnit = (nextUnit: FdvUnit) => {
    if (nextUnit === unit) return;
    setUnit(nextUnit);
    if (isFocused && draft.trim() !== "") {
      commitDraft(draft, nextUnit);
      return;
    }
    setDraft(formatFdvDisplay(value / FDV_UNIT_MULTIPLIER[nextUnit]));
  };

  return (
    <div className="relative min-w-0">
      <div className="mb-1">
        <FieldLabel label={label} info={info} hint={fdvUnitCaption(unit)} />
      </div>
      <CompoundInput
        trailing={
          <PillToggle
            value={unit}
            options={[
              { id: "M" as const, label: "M", title: "Millions" },
              { id: "B" as const, label: "B", title: "Billions" },
            ]}
            onChange={selectUnit}
            layoutId="marketcap-unit-toggle"
          />
        }
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "" || draft.trim() === ".") {
              setDraft("0");
              applyValue(0);
              return;
            }
            commitDraft(draft);
            const parsed = parseCommaNumber(draft);
            if (parsed != null) setDraft(formatFdvDisplay(parsed));
          }}
          onChange={(e) => {
            const input = e.target;
            const nextRaw = input.value;
            if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

            const cursor = input.selectionStart ?? nextRaw.length;
            const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
            const formatted = formatCommaInput(nextRaw, 3);
            setDraft(formatted);

            const parsed = parseCommaNumber(formatted);
            if (parsed != null) applyValue(parsed * FDV_UNIT_MULTIPLIER[unit]);

            requestAnimationFrame(() => {
              if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
            });
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-[0.875rem] py-[0.625rem] text-sm tabular-nums outline-none",
            accent && "text-accent"
          )}
        />
      </CompoundInput>
    </div>
  );
}



