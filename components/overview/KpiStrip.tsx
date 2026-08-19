"use client";

import { useMemo, useState } from "react";
import {
  APR_TOTAL_AURA_SUPPLY,
  APR_ASSUMED_ALLOCATION_PCT,
  APR_ASSUMED_FDV,
  buildTvlViews,
  computeDepositApr,
  type OverviewMetricView,
} from "@/lib/overview-metrics";
import { useLiveFinancials } from "@/components/live/LiveFinancialProvider";
import { useTvlView } from "@/components/overview/TvlViewContext";
import { PanelLabel } from "@/components/overview/PanelCard";
import { AuraDropCountdown } from "@/components/overview/AuraDropCountdown";
import { KpiTerminalCounter } from "@/components/cards/KpiTerminalCounter";
import { cn } from "@/lib/utils";

/** Shared shell for the four cards along the top of the dashboard. The
 * icon sits opposite the label; `children` is the value block below.
 *
 * Padding matches PanelCard's exactly (px-5 py-4, not this card's own
 * previous px-4 py-3) and the label is the same PanelLabel every other
 * panel uses. Together those two put every title on the page — this row's
 * four and the panels below — at an identical inset from its own card's
 * edge, so none of them reads as a different size or sitting at a
 * different level from the rest. */
function KpiCard({
  label,
  icon,
  centered,
  children,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Centre the title over the card rather than sitting it against the left
   * edge. Only the TVL card wants this — it's the one whose contents below
   * are a symmetrical rule-and-two-columns block, so a left-hung title read
   * as off-axis there. The other three are left-aligned top to bottom. */
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    // One gap on the column instead of a margin picked per child (they were
    // 4px under the title and 6–8px under the value), so every block in every
    // one of these cards is the same distance from the one above it.
    <div className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-bulk-base)] px-5 py-4">
      {/* leading-none, here and on the lines under each value: at its default
          line height the 11px title carries ~5px of dead space inside its own
          box, which the flex gap then adds to. Equal gaps between the boxes
          only read as equal spacing if the boxes hold nothing but their
          text. */}
      <div
        className={cn(
          "flex items-start gap-2 leading-none",
          centered ? "justify-center" : "justify-between"
        )}
      >
        {/* When centred, the icon hangs off the END OF THE TITLE rather than
            off the card's corner. Two things follow from that, both of them
            the point: the title still centres on the card, because the icon is
            absolutely positioned and so contributes no width to the flex row;
            and the distance from the words to the ? is a fixed 6px, identical
            on every card that has one, instead of being whatever the gap
            between that particular title and the card's right edge happens to
            be — which on these four cards ran from 40px to 90px. */}
        <span className={cn("relative inline-flex min-w-0", !centered && "min-w-0 flex-1")}>
          <PanelLabel>{label}</PanelLabel>
          {icon && (
            <span
              className={cn(
                "shrink-0 text-text-dim",
                // Centred on the title's own line rather than hung from its
                // top: the circle is 14px against 11px of text, so aligning
                // the boxes' tops leaves it visibly sitting low.
                "absolute left-full top-1/2 ml-1.5 -translate-y-1/2"
              )}
            >
              {icon}
            </span>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

/** The "?" in a card's corner that reveals an explanation on hover.
 *
 * Shared rather than written out per card: there are two of these now, in
 * opposite corners of the same row, and a difference of a pixel or a shade
 * between them would read as a difference in meaning.
 *
 * Hover AND focus, because it has to be reachable without a mouse — tabIndex
 * makes it focusable, and the same pair of handlers drives both. */
function HelpDot({
  label,
  onOpenChange,
}: {
  /** What a screen reader announces — the question the panel answers. */
  label: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <span
      tabIndex={0}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      onFocus={() => onOpenChange(true)}
      onBlur={() => onOpenChange(false)}
      aria-label={label}
      // 17px around a 10.5px glyph, up from 14 around 8.5. At the smaller size
      // the ? was a mark rather than a character — legible only if you already
      // knew what it was. This puts it at the same size as the title beside it,
      // which is the smallest type on the card that is meant to be read.
      // Colours live in .help-dot; see the note on it.
      className="help-dot flex h-[17px] w-[17px] cursor-default items-center justify-center rounded-full border text-[10.5px] font-semibold leading-none transition-colors"
    >
      ?
    </span>
  );
}

function formatFdv(fdv: number): string {
  return fdv >= 1_000_000_000 ? `$${fdv / 1_000_000_000}B` : `$${fdv / 1_000_000}M`;
}

function signedUsd(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

function signedPct(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

/** buildTvlViews already resolves each figure's tone, so the card maps that
 * name straight to a class rather than re-deriving it from the sign. */
const TONE_NAMED: Record<"positive" | "negative" | "neutral", string> = {
  positive: "text-bid-green",
  negative: "text-[var(--color-neg-strong)]",
  neutral: "text-text-primary",
};

/** One campaign week's modelled APR. */
interface AprWeek {
  week: number;
  apr: number;
  /** The week still running — its pool and TVL are live, not settled. */
  isCurrent: boolean;
}

/**
 * Weekly APR as bars, replacing the sparkline that used to sit here. The
 * sparkline was not a history at all: it re-ran today's emission pool over
 * each past TVL reading, so it drew what the rate *would* have been rather
 * than what it was. Every week's pool is on record (`weekPool`) alongside the
 * TVL it was paid against (`weekTvl`), so these bars are the real figures —
 * which is also why they can be read one week at a time on hover.
 */
function AprWeekBars({
  weeks,
  activeWeek,
  onActiveWeekChange,
}: {
  weeks: AprWeek[];
  activeWeek: number | null;
  onActiveWeekChange: (week: number | null) => void;
}) {
  // Bars are a share of the tallest, measured from zero — the honest baseline
  // for a bar chart, and with the spread these weeks have (roughly 270% to
  // 540%) the shortest still reads as half the tallest rather than a stub.
  const max = Math.max(...weeks.map((w) => w.apr));

  return (
    <div
      className="mt-auto flex h-[30px] items-stretch gap-[3px]"
      onMouseLeave={() => onActiveWeekChange(null)}
    >
      {weeks.map((w) => {
        const active = activeWeek === w.week;
        // Only while it's the brightest thing here anyway. Once another week
        // is hovered this bar drops to 45% along with the rest, and a pulse
        // running on a dimmed bar reads as the chart glitching rather than as
        // "this is the week in progress".
        const pulsing = w.isCurrent && (activeWeek == null || active);
        return (
          <div
            key={w.week}
            // The hover target is the full-height column, not the bar: a
            // short bar is a few px tall and would be near-impossible to
            // land on otherwise.
            className="flex flex-1 cursor-default items-end"
            onMouseEnter={() => onActiveWeekChange(w.week)}
            role="img"
            aria-label={`Week ${w.week}: ${w.apr.toFixed(1)}% APR`}
          >
            <div
              className={cn(
                "w-full rounded-[2px] transition-[background-color]",
                pulsing && "apr-week-pulse",
                activeWeek != null && !active && "opacity-45"
              )}
              style={{
                height: `${Math.max(8, (w.apr / max) * 100)}%`,
                background: active || w.isCurrent ? "#ffb547" : "rgba(255,181,71,0.32)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** One of the two stat columns under the TVL headline. Centred in its own
 * half of the row rather than left-aligned in a huddle at the right, so the
 * pair reads as two columns of a small table under the rule above them. */
function SubStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  /** Optional trailing qualifier, e.g. the percentage behind an amount. */
  sub?: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 px-2 text-center">
      <p className="m-0 truncate text-[9.5px] uppercase leading-none tracking-[0.1em] text-text-muted">
        {label}
      </p>
      {/* The qualifier sits on the same line, just after the figure — smaller
          and unbolded so it reads as an aside to the number rather than a
          second number. Its own line pushed this column a row taller than the
          one beside it, leaving the pair visibly uneven. */}
      <p className={cn("m-0 mt-2 truncate text-[13px] font-semibold leading-none", tone)}>
        {value}
        {sub && <span className="ml-1.5 text-[11px] font-normal">{sub}</span>}
      </p>
    </div>
  );
}

/**
 * The four headline cards along the top of the Overview. These carry the
 * campaign's "at a glance" numbers so the panels below can be purely
 * visual — the TVL panel is a chart with no headline of its own now, and
 * OG Hodlers moved off the Depositors panel entirely.
 */
export function KpiStrip({
  ogHodlers,
}: {
  /** Server-derived: OG-hodler status comes from full leaderboard history,
   * which the live financial poll doesn't carry. */
  ogHodlers: { count: number; pctOfDepositors: number };
}) {
  const live = useLiveFinancials();
  const [aprExplained, setAprExplained] = useState(false);
  const [ogExplained, setOgExplained] = useState(false);

  // Same view the chart's Current/Projected toggle drives, so this card and
  // the panel below it are never showing different numbers.
  const { viewId } = useTvlView();
  const tvlViews = buildTvlViews(live.currentTvl, live.projection, live.secondaryMetrics);
  const tvlView: OverviewMetricView = tvlViews.find((v) => v.id === viewId) ?? tvlViews[0];
  const isProjected = tvlView.id === "projected";
  // Current has two sub-stats and no notes; projected has two notes plus a
  // sub-stat. Taking the first two of the combined list gives each view its
  // own most-relevant pair without a per-view special case.
  const tvlSubStats = [...(tvlView.notes ?? []), ...tvlView.subStats].slice(0, 2);

  const aprPercent = computeDepositApr(live.depositPredict.depositPool, live.currentTvl);

  // One bar per campaign week, each from that week's own settled pool and the
  // TVL it was paid against. The week in progress has neither yet, so it uses
  // the live pool and TVL — the same two numbers behind the headline above,
  // which is what keeps hovering the last bar showing exactly the figure the
  // card already reads.
  const { campaignWeek, weekPool, weekTvl } = live.depositPredict;
  const aprWeeks = useMemo<AprWeek[]>(() => {
    const out: AprWeek[] = [];
    for (let week = 1; week <= campaignWeek; week += 1) {
      const isCurrent = week === campaignWeek;
      const pool = isCurrent ? live.depositPredict.depositPool : weekPool?.[week];
      const tvl = isCurrent ? live.currentTvl : weekTvl?.[week];
      if (pool == null || tvl == null) continue;
      const apr = computeDepositApr(pool, tvl);
      if (apr != null) out.push({ week, apr, isCurrent });
    }
    return out;
  }, [campaignWeek, weekPool, weekTvl, live.depositPredict.depositPool, live.currentTvl]);

  const [activeAprWeek, setActiveAprWeek] = useState<number | null>(null);
  const shownAprWeek = aprWeeks.find((w) => w.week === activeAprWeek) ?? null;
  // Falls back to the live figure rather than the last bar's, so the card
  // reads identically to before whenever nothing is hovered.
  const shownApr = shownAprWeek ? shownAprWeek.apr : aprPercent;
  const shownWeek = shownAprWeek ? shownAprWeek.week : campaignWeek;

  return (
    // The cards stretch to a common height here (grid default), and each one
    // then pushes its last block to the floor with mt-auto — the stats row in
    // TVL, the week bars, the countdown, the depositor share. That's what
    // lands all four on one line across the strip instead of each ending
    // wherever its own contents happened to run out. Adding a block to any
    // card means moving that mt-auto to the new last one.
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.7fr_1fr_1fr_1fr] lg:gap-4">
      <KpiCard
        label={
          <>
            Total Value Locked
            {/* Spelled out when projected: the same card showing a
                forward-looking figure under an unqualified "Total Value
                Locked" would read as the amount on-chain right now.

                A second word after a divider rather than a bordered pill —
                at this size the pill's own border and padding made it the
                loudest thing in the title row, competing with the heading it
                qualifies. The rule and the accent colour carry it. */}
            {isProjected && (
              <>
                <span className="mx-2 font-normal text-text-dim">|</span>
                <span className="text-accent">Projected</span>
              </>
            )}
          </>
        }
        centered
      >
        {/* Centred, unlike the headline in the other three cards: this one
            sits over a two-column rule-and-stats block, so left-aligning it
            hung the figure off the left edge of a symmetrical layout. */}
        <p className="m-0 min-w-0 text-center text-[clamp(20px,2.1vw,27px)] font-semibold leading-none tracking-[-0.02em]">
          <KpiTerminalCounter value={tvlView.valueNumber} format="usd-full" />
        </p>
        {/* Rule between the headline and its supporting figures, and a second
            one between the two of them. Same treatment in both views — the
            current view's pair (24H net flow, 7D growth) sits in exactly the
            columns the projected view's does.

            mt-auto here rather than on the stats row below, so the rule
            travels down with the figures it belongs to. It's what puts this
            block on the floor of the card — see the note on the strip. */}
        <div className="mt-auto h-px w-full bg-[var(--color-line)]" />
        <div className="grid grid-cols-2 divide-x divide-[var(--color-line)]">
          {tvlSubStats.map((stat) => (
            <SubStat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              sub={stat.sub}
              tone={TONE_NAMED[stat.tone ?? "neutral"]}
            />
          ))}
        </div>
      </KpiCard>

      <KpiCard
        label="Pre-Deposits APR"
        icon={
          aprPercent != null ? (
            <HelpDot label="How this APR is modelled" onOpenChange={setAprExplained} />
          ) : null
        }
        centered
      >
        <div className="relative">
          <p className="m-0 truncate text-center text-[clamp(20px,2.1vw,27px)] font-semibold leading-none tracking-[-0.02em] text-accent">
            {shownApr != null ? `${shownApr.toFixed(1)}%` : "—"}
          </p>
          {aprExplained && aprPercent != null && (
            <p className="hodler-explain pointer-events-none absolute right-0 top-full z-30 mt-2 w-[210px] rounded-lg border border-[var(--color-line-strong)] bg-[#17171a] p-2.5 text-[11px] font-normal leading-relaxed text-text-secondary shadow-[0_14px_36px_rgba(0,0,0,.55)]">
              Modelled at {formatFdv(APR_ASSUMED_FDV)} FDV, {APR_ASSUMED_ALLOCATION_PCT}% airdrop
              allocation, {(APR_TOTAL_AURA_SUPPLY / 1_000_000).toFixed(0)}M total AURA supply — not
              a guaranteed rate. This campaign pays Aura points, not yield.
            </p>
          )}
        </div>
        {/* Which week the figure belongs to — on its own line under it rather
            than tucked alongside, where it read as part of the percentage.
            Always rendered, not only while hovering: the number changes under
            the cursor, and without a label it would be unclear that it had. */}
        {shownApr != null && aprWeeks.length > 0 && (
          <p className="m-0 text-center text-[11px] leading-none text-text-muted">
            W{shownWeek}
          </p>
        )}
        {aprWeeks.length > 1 && (
          <AprWeekBars
            weeks={aprWeeks}
            activeWeek={activeAprWeek}
            onActiveWeekChange={setActiveAprWeek}
          />
        )}
      </KpiCard>

      <KpiCard label="Current Week" centered>
        <p className="m-0 truncate text-center text-[clamp(20px,2.1vw,27px)] font-semibold leading-none tracking-[-0.02em] text-text-primary">
          {`W${live.depositPredict.campaignWeek}`}
        </p>
        {/* Was a static "Aug 15 – Aug 22, 2026" date range — replaced with
            the live countdown that used to sit in the Aura Overview panel.
            Same underlying timestamp (the next weekly snapshot); "Next Aura
            drop" made sense as a label sitting next to the Aura donut, but
            reads oddly detached from it up here, so it's renamed to fit
            where it lives now. */}
        <div className="mt-auto">
          <AuraDropCountdown
            nextSnapshotTimestamp={live.depositPredict.nextSnapshotTimestamp}
            showCaption={false}
            label="Time left:"
            centered
          />
        </div>
      </KpiCard>

      <KpiCard
        label="OG Hodlers"
        icon={<HelpDot label="Who counts as an OG Hodler" onOpenChange={setOgExplained} />}
        centered
      >
        <div className="relative">
          <p className="m-0 truncate text-center text-[clamp(20px,2.1vw,27px)] font-semibold leading-none tracking-[-0.02em] text-[#00B481]">
            {ogHodlers.count.toLocaleString("en-US")}
          </p>
          {ogExplained && (
            /* Anchored to the card's right edge like the APR one — this is the
               last card in the row, so a panel hung the other way would run
               off the page. */
            <p className="hodler-explain pointer-events-none absolute right-0 top-full z-30 mt-2 w-[230px] rounded-lg border border-[var(--color-line-strong)] bg-[#17171a] p-2.5 text-[11px] font-normal leading-relaxed text-text-secondary shadow-[0_14px_36px_rgba(0,0,0,.55)]">
              Wallets that were already in during week 1 — they earned Aura that week and have
              never withdrawn a cent since. Deposits that came later, or that have been pulled out
              even once, don&apos;t count.
            </p>
          )}
        </div>
        <p className="m-0 mt-auto truncate text-center text-[11.5px] leading-none text-text-muted">
          {ogHodlers.pctOfDepositors.toFixed(1)}% of total depositors
        </p>
      </KpiCard>
    </div>
  );
}
