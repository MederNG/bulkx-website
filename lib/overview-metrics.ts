import { aggregateBySource, type CategoryBreakdownItem } from "@/lib/aura-category-groups";
import {
  formatUsdCompact,
  type ProjectedSnapshotTvl,
} from "@/lib/projected-snapshot-tvl";
import type { TvlKpiSecondaryMetrics } from "@/lib/tvl-kpi-secondary";
import type { Snapshot } from "@/types";

/** Headline figures are shown in full — the design never abbreviates them. */
function usdFull(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function numFull(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export interface OverviewSubStat {
  label: string;
  value: string;
  /** Second line under the value — the percentage behind an amount, say.
   * Carried separately rather than baked into `value` so the card can stack
   * the two instead of running them together on one line. */
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface OverviewDonutSegment {
  id: string;
  label: string;
  color: string;
  pct: number;
  /** Raw Aura points behind this share, for the hover detail. */
  points: number;
}

export interface OverviewDistributionBar {
  id: string;
  label: string;
  count: number;
  pct: number;
}

/** One of the size tiers in the depositor cohort ring. */
export interface DepositTier {
  id: string;
  label: string;
  count: number;
  /** Share of all depositors, 0-100. */
  pct: number;
  /** USD this tier's wallets still hold — deposits net of withdrawals. */
  held: number;
  /** Share of all held USD, 0-100. */
  heldPct: number;
  /** Held USD per wallet in the tier. */
  avgHeld: number;
  color: string;
}

/**
 * Bucket-index ranges per tier, matching `depositSizeDistribution`'s fixed
 * 7-bucket order (see DEPOSIT_SIZE_BUCKETS in lib/stats.ts): <$100, $100-1K,
 * $1K-10K, $10K-100K, $100K-500K, $500K-1M, $1M+. Six tiers over those seven
 * buckets — one each, except the top tier folding the last two ($500K-1M
 * and $1M+) together. Shared by the tier aggregation below and the
 * distribution curve's per-segment highlighting.
 */
export const DEPOSIT_TIER_BUCKET_RANGES: Record<string, [number, number]> = {
  snowflake: [0, 0],
  bulker: [1, 1],
  lilYeti: [2, 2],
  bulkingYeti: [3, 3],
  auramaxer: [4, 4],
  megalodon: [5, 6],
};

/** One side of a metric that can be looked at two ways, e.g. TVL now vs projected. */
export interface OverviewMetricView {
  id: string;
  /** Short label for the in-card toggle. */
  toggleLabel: string;
  /** Raw number backing `value`, for the count-up animation. */
  valueNumber: number;
  value: string;
  change: string | null;
  changeTone: "positive" | "negative" | "neutral";
  subStats: OverviewSubStat[];
  /** Supporting lines shown under the headline (expected growth). Same shape
   * as subStats — the card renders the two from one concatenated list. */
  notes?: OverviewSubStat[];
}

/** Shared by the Overview ring, Aura Sources breakdown, and Aura Distribution
 * histogram, so a source that is gold on one chart is gold on the others.
 * Drill-down views (Retro, Week N) can have more than six slices; the extra
 * four stop Roles / Others wrapping back onto Bulk validator stake / Testnet
 * and give the ten Aura buckets a unique bar each. */
/** Overview / Aura ring duochrome: primary gold, secondary slate blues.
 * Index 0 (usually the largest share) takes gold; the rest step through
 * slate so proportions stay readable without a rainbow. */
export const CHART_GOLD = "#FFB547";
/** Ordered bright→dull slate companions (subset of SLATE_RAMP). Prefer
 * `chartPrimaryRamp` when the series length is known. */
export const CHART_SLATE = [
  "#C5D6E6",
  "#8AABC4",
  "#5E819E",
  "#4A6B84",
  "#3D5A73",
  "#263B4E",
] as const;

/** Ordered bright→dull slate for sequential charts (Aura histogram buckets).
 * Unlike chartDuochrome this never injects gold mid-series. */
const SLATE_RAMP = [
  "#C5D6E6",
  "#A8C0D4",
  "#8AABC4",
  "#7296B0",
  "#5E819E",
  "#4A6B84",
  "#3D5A73",
  "#314B61",
  "#263B4E",
  "#1C2E3E",
] as const;

export function chartSlateRamp(index: number, count: number): string {
  if (count <= 1) return SLATE_RAMP[0];
  const t = Math.min(1, Math.max(0, index / (count - 1)));
  const i = Math.round(t * (SLATE_RAMP.length - 1));
  return SLATE_RAMP[i];
}

/** Gold on the primary (index 0), then bright→dull slate for the rest.
 * Idle gold lives on the first mark; hover transfers it (caller borrows). */
export function chartPrimaryRamp(index: number, count: number): string {
  if (index <= 0) return CHART_GOLD;
  return chartSlateRamp(index - 1, Math.max(1, count - 1));
}

/** Fallback when series length is unknown — same ramp as chartPrimaryRamp. */
export function chartDuochrome(index: number, count = CHART_SLATE.length + 1): string {
  return chartPrimaryRamp(index, count);
}

export const CHART_RED = "#E55A4E";
export const CHART_TEAL = "#1FB88A";

export const DONUT_COLORS = [
  CHART_GOLD,
  ...CHART_SLATE,
  "#5B9BD4",
  "#8AABC4",
];

/** Homepage ring stays at six named sources even though the palette now
 * has room for drill-downs. More than that and the legend crowds the tier
 * table it has to line up with. */
const MAX_OVERVIEW_DONUT_SLICES = 6;

function toneOf(value: number | null | undefined): "positive" | "negative" | "neutral" {
  if (value == null) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function signedPct(value: number | null): string | null {
  if (value == null) return null;
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function signedUsd(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${formatUsdCompact(Math.abs(value))}`;
}

/**
 * Current vs projected TVL as two views of one card. Exported so the client
 * can rebuild it from live-polled data and re-trigger the count-up animation
 * on refresh, instead of only on the initial server render.
 */
export function buildTvlViews(
  currentTvl: number,
  projection: ProjectedSnapshotTvl,
  secondaryMetrics: TvlKpiSecondaryMetrics
): OverviewMetricView[] {
  const currentView: OverviewMetricView = {
    id: "current",
    toggleLabel: "Current",
    valueNumber: currentTvl,
    value: usdFull(currentTvl),
    change: signedPct(secondaryMetrics.growth7dPct)
      ? `${signedPct(secondaryMetrics.growth7dPct)} · 7D`
      : null,
    changeTone: toneOf(secondaryMetrics.growth7dPct),
    subStats: [
      {
        label: "24H net flow",
        value: signedUsd(secondaryMetrics.netFlow24h),
        tone: toneOf(secondaryMetrics.netFlow24h),
      },
      {
        label: "7D growth",
        value: signedPct(secondaryMetrics.growth7dPct) ?? "—",
        tone: toneOf(secondaryMetrics.growth7dPct),
      },
    ],
  };

  if (!projection.available) return [currentView];

  const projectedView: OverviewMetricView = {
    id: "projected",
    toggleLabel: "Projected",
    valueNumber: projection.projectedTvl,
    value: usdFull(projection.projectedTvl),
    change: `${signedPct(projection.expectedGrowthPercent)} · vs current`,
    changeTone: toneOf(projection.expectedGrowthPercent),
    // No "Snapshot" note: the KPI strip's Current Week card already counts
    // down to that same moment, so spelling out the date here spent one of
    // the card's two stat slots restating it.
    notes: [
      {
        label: "Expected growth",
        value: signedUsd(projection.expectedGrowth),
        sub: `(${signedPct(projection.expectedGrowthPercent) ?? "—"})`,
        tone: toneOf(projection.expectedGrowth),
      },
    ],
    subStats: [
      {
        label: "Weighted daily flow",
        value: signedUsd(projection.weightedDailyFlow),
        tone: toneOf(projection.weightedDailyFlow),
      },
    ],
  };

  return [currentView, projectedView];
}

// APR is modelled, not observed — this campaign pays Aura points, not yield,
// so there is no on-chain rate to read. FDV and allocation are the same
// default scenario the FDV calculator itself starts from (Tools page), not a
// number invented for this card. The panel must say so out loud; never show
// this as a bare, unqualified percentage.
export const APR_ASSUMED_FDV = 500_000_000;
export const APR_ASSUMED_ALLOCATION_PCT = 30;
/**
 * The campaign's total distributable AURA supply — fixed, not the "earned
 * so far" figure shown elsewhere on the page (that one only grows over the
 * campaign and would make the modelled price drift for the wrong reason).
 */
export const APR_TOTAL_AURA_SUPPLY = 60_000_000;

export interface DepositAprResult {
  aprPercent: number | null;
  assumedFdv: number;
  assumedAllocationPct: number;
  currentWeek: number;
  /** Next weekly Aura snapshot (Sat 13:00 UTC) — not a final-airdrop date;
   * no such date exists anywhere in the campaign data. */
  nextSnapshotTimestamp: number;
}

/**
 * APR = (Weekly AURA Emissions / TVL) × (FDV × Allocation / Total AURA Supply) × 52 × 100%
 *
 * Exported so the KPI strip can recompute it from the live-polled TVL rather
 * than showing a figure that drifts out of step with the TVL card beside it.
 */
export function computeDepositApr(weeklyAuraEmissions: number, currentTvl: number): number | null {
  if (currentTvl <= 0) return null;
  const auraPerDollarPerWeek = weeklyAuraEmissions / currentTvl;
  const auraPriceUsd =
    (APR_ASSUMED_FDV * (APR_ASSUMED_ALLOCATION_PCT / 100)) / APR_TOTAL_AURA_SUPPLY;
  return auraPerDollarPerWeek * auraPriceUsd * 52 * 100;
}

export interface OverviewPanelsData {
  tvl: {
    value: string;
    change: string | null;
    changeTone: "positive" | "negative" | "neutral";
    views: OverviewMetricView[];
  };
  auraSources: {
    totalAuraValue: string;
    totalAuraNumber: number;
    donut: OverviewDonutSegment[];
  };
  depositApr: DepositAprResult;
  depositorsAnalysis: {
    totalDepositors: number;
    bars: OverviewDistributionBar[];
    ogHodlers: { count: number; pctOfDepositors: number };
    /** Six mutually exclusive size tiers — what the ring and the stat list
     * both draw from directly. */
    tiers: DepositTier[];
  };
}

export function buildOverviewPanels(input: {
  currentTvl: number;
  totalAura: number;
  depositWallets: number;
  depositSizeDistribution: { bucket: string; count: number; held: number }[];
  ogHodlers: number;
  weeklyAuraEmissions: number;
  projection: ProjectedSnapshotTvl;
  secondaryMetrics: TvlKpiSecondaryMetrics;
  categoryBreakdown: CategoryBreakdownItem[];
  currentWeek: number;
  nextSnapshotTimestamp: number;
}): OverviewPanelsData {
  const {
    currentTvl,
    totalAura,
    depositWallets,
    depositSizeDistribution,
    ogHodlers,
    weeklyAuraEmissions,
    projection,
    secondaryMetrics,
    categoryBreakdown,
    currentWeek,
    nextSnapshotTimestamp,
  } = input;

  const views = buildTvlViews(currentTvl, projection, secondaryMetrics);
  const current = views[0];

  const tvl = {
    value: current.value,
    change: current.change,
    changeTone: current.changeTone,
    views,
  };

  // Keep the meaningful sources named and roll the long tail into "Others", so
  // the ring stays readable instead of fraying into 1% slivers.
  const MIN_DONUT_SHARE = 2.5;
  const allSources = aggregateBySource(categoryBreakdown).filter((s) => s.share > 0);
  const named = allSources.filter((s) => s.share >= MIN_DONUT_SHARE);
  const tailShare = allSources
    .filter((s) => s.share < MIN_DONUT_SHARE)
    .reduce((sum, s) => sum + s.share, 0);
  const tailPoints = allSources
    .filter((s) => s.share < MIN_DONUT_SHARE)
    .reduce((sum, s) => sum + s.points, 0);

  // Largest share first, so colours are assigned the same way everywhere —
  // the biggest source always takes the accent gold.
  const sources = [
    ...named.map((s) => ({ key: s.key, category: s.category, share: s.share, points: s.points })),
    ...(tailShare > 0
      ? [{ key: "others", category: "Others", share: tailShare, points: tailPoints }]
      : []),
  ]
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_OVERVIEW_DONUT_SLICES);

  const auraSources = {
    totalAuraValue: numFull(totalAura),
    totalAuraNumber: totalAura,
    donut: sources.map((source, i) => ({
      id: source.key,
      label: source.category,
      color: chartPrimaryRamp(i, sources.length),
      pct: source.share,
      points: source.points,
    })),
  };

  const depositApr: DepositAprResult = {
    aprPercent: computeDepositApr(weeklyAuraEmissions, currentTvl),
    assumedFdv: APR_ASSUMED_FDV,
    assumedAllocationPct: APR_ASSUMED_ALLOCATION_PCT,
    currentWeek,
    nextSnapshotTimestamp,
  };

  // depositSizeDistribution buckets, in order: <$100, $100-1K, $1K-10K,
  // $10K-100K, $100K-500K, $500K-1M, $1M+ (see DEPOSIT_SIZE_BUCKETS in
  // lib/stats.ts). Regrouped into six mutually exclusive size tiers, one per
  // bucket except the top tier folding the last two together, so the ring's
  // slices never double-count the same wallet.
  const tierDefs: { id: string; label: string; count: number; held: number; color: string }[] = [
    {
      id: "snowflake",
      label: "Snowflake (<$100)",
      count: depositSizeDistribution[0]?.count ?? 0,
      held: depositSizeDistribution[0]?.held ?? 0,
      color: chartPrimaryRamp(0, 6),
    },
    {
      id: "bulker",
      label: "Bulker ($100-1K)",
      count: depositSizeDistribution[1]?.count ?? 0,
      held: depositSizeDistribution[1]?.held ?? 0,
      color: chartPrimaryRamp(1, 6),
    },
    {
      id: "lilYeti",
      label: "Lil Yeti ($1K-10K)",
      count: depositSizeDistribution[2]?.count ?? 0,
      held: depositSizeDistribution[2]?.held ?? 0,
      color: chartPrimaryRamp(2, 6),
    },
    {
      id: "bulkingYeti",
      label: "Bulking Yeti ($10K-100K)",
      count: depositSizeDistribution[3]?.count ?? 0,
      held: depositSizeDistribution[3]?.held ?? 0,
      color: chartPrimaryRamp(3, 6),
    },
    {
      id: "auramaxer",
      label: "Auramaxer ($100K-500K)",
      count: depositSizeDistribution[4]?.count ?? 0,
      held: depositSizeDistribution[4]?.held ?? 0,
      color: chartPrimaryRamp(4, 6),
    },
    {
      id: "megalodon",
      label: "Megalodon ($500K+)",
      count: depositSizeDistribution.slice(5).reduce((sum, b) => sum + b.count, 0),
      held: depositSizeDistribution.slice(5).reduce((sum, b) => sum + b.held, 0),
      color: chartPrimaryRamp(5, 6),
    },
  ];

  // Both shares are taken against the tiers' own totals rather than against
  // the wallet count the rest of the page quotes: `depositWallets` comes from
  // the live totals endpoint while the tiers are cut from the leaderboard,
  // which carries a few hundred fewer depositors — so shares based on it added
  // up to 96.3%, and a share is only meaningful against a base its own parts
  // add up to.
  //
  // The held total now lands near TVL by construction, since withdrawals are
  // netted off per wallet, but it will not match to the dollar: TVL is polled
  // live and the leaderboard is a snapshot taken at its own moment.
  const tierCountTotal = tierDefs.reduce((sum, t) => sum + t.count, 0);
  const tierHeldTotal = tierDefs.reduce((sum, t) => sum + t.held, 0);
  const tierBase = tierCountTotal > 0 ? tierCountTotal : 1;
  const heldBase = tierHeldTotal > 0 ? tierHeldTotal : 1;
  const tiers: DepositTier[] = tierDefs.map((t) => ({
    ...t,
    pct: (t.count / tierBase) * 100,
    heldPct: (t.held / heldBase) * 100,
    avgHeld: t.count > 0 ? t.held / t.count : 0,
  }));

  const depositorsAnalysis = {
    // The population the tiers actually describe — see the note on tierBase.
    totalDepositors: tierCountTotal,
    bars: depositSizeDistribution.map((b) => ({
      id: b.bucket,
      label: b.bucket,
      count: b.count,
      pct: depositWallets > 0 ? (b.count / depositWallets) * 100 : 0,
    })),
    ogHodlers: {
      count: ogHodlers,
      pctOfDepositors: depositWallets > 0 ? (ogHodlers / depositWallets) * 100 : 0,
    },
    tiers,
  };

  return { tvl, auraSources, depositApr, depositorsAnalysis };
}
