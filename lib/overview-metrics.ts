import { aggregateBySource, type CategoryBreakdownItem } from "@/lib/aura-category-groups";
import { DEPOSITOR_AURA_RANGES } from "@/lib/utils";

function numFull(value: number): string {
  return Math.round(value).toLocaleString("en-US");
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
  /** Aura this tier's wallets hold in total. */
  aura: number;
  /** Share of all Aura in these tiers, 0-100. */
  auraPct: number;
  /** Aura per wallet in the tier. */
  avgAura: number;
  /** Compact min–max Aura among wallets in the tier. */
  auraRange: string;
  color: string;
}

type DepositSizeBucket = {
  bucket: string;
  count: number;
  held: number;
  aura: number;
  auraMin: number;
  auraMax: number;
};

const EMPTY_BUCKET: DepositSizeBucket = {
  bucket: "",
  count: 0,
  held: 0,
  aura: 0,
  auraMin: 0,
  auraMax: 0,
};

function mergeBuckets(buckets: DepositSizeBucket[]): DepositSizeBucket {
  return buckets.reduce(
    (acc, b) => ({
      bucket: acc.bucket,
      count: acc.count + b.count,
      held: acc.held + b.held,
      aura: acc.aura + b.aura,
      auraMin: Math.min(acc.auraMin, Number.isFinite(b.auraMin) ? b.auraMin : Infinity),
      auraMax: Math.max(acc.auraMax, Number.isFinite(b.auraMax) ? b.auraMax : 0),
    }),
    { ...EMPTY_BUCKET, auraMin: Infinity },
  );
}

/** Shared by the Overview ring, Aura Sources breakdown, and Aura Distribution
 * histogram, so a source that is gold on one chart is gold on the others.
 * Drill-down views (Retro, Week N) can have more than six slices; the extra
 * four stop Roles / Others wrapping back onto Bulk validator stake / Testnet
 * and give the ten Aura buckets a unique bar each. */
/**
 * Chart colours are CSS custom properties, not literals: SVG `fill` and
 * `stroke` resolve var() at paint time, so the same server-rendered payload
 * repaints when the theme flips without re-fetching or re-computing.
 *
 * Identity still works — callers compare against CHART_GOLD to decide which
 * mark is the primary one, and string equality holds across both themes.
 */

/** Overview / Aura ring duochrome: primary accent, then the supporting ramp.
 * Index 0 (usually the largest share) takes the accent; the rest step through
 * the ramp so proportions stay readable without a rainbow. */
export const CHART_GOLD = "var(--t-accent)";
/** Ordered prominent→recessive for sequential charts (Aura histogram buckets).
 * Unlike chartPrimaryRamp this never injects the accent mid-series. Each theme
 * defines these seven stops by interpolating its own pair of support tones,
 * walked so index 0 is always the most prominent against that background. */
const SUPPORT_RAMP = [
  "var(--t-ramp-0)",
  "var(--t-ramp-1)",
  "var(--t-ramp-2)",
  "var(--t-ramp-3)",
  "var(--t-ramp-4)",
  "var(--t-ramp-5)",
  "var(--t-ramp-6)",
] as const;

export function chartSlateRamp(index: number, count: number): string {
  if (count <= 1) return SUPPORT_RAMP[0];
  const t = Math.min(1, Math.max(0, index / (count - 1)));
  const i = Math.round(t * (SUPPORT_RAMP.length - 1));
  return SUPPORT_RAMP[i];
}

/** Gold on the primary (index 0), then bright→dull slate for the rest.
 * Idle gold lives on the first mark; hover transfers it (caller borrows). */
export function chartPrimaryRamp(index: number, count: number): string {
  if (index <= 0) return CHART_GOLD;
  return chartSlateRamp(index - 1, Math.max(1, count - 1));
}

/** Homepage ring stays at six named sources even though the palette now
 * has room for drill-downs. More than that and the legend crowds the tier
 * table it has to line up with. */
const MAX_OVERVIEW_DONUT_SLICES = 6;

/**
 * The campaign's total distributable AURA supply — fixed, not the "earned
 * so far" figure shown elsewhere on the page (that one only grows over the
 * campaign and would make the modelled price drift for the wrong reason).
 */
export const APR_TOTAL_AURA_SUPPLY = 60_000_000;

export interface OverviewPanelsData {
  auraSources: {
    totalAuraValue: string;
    totalAuraNumber: number;
    donut: OverviewDonutSegment[];
  };
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
  totalAura: number;
  depositWallets: number;
  depositSizeDistribution: DepositSizeBucket[];
  ogHodlers: number;
  categoryBreakdown: CategoryBreakdownItem[];
}): OverviewPanelsData {
  const {
    totalAura,
    depositWallets,
    depositSizeDistribution,
    ogHodlers,
    categoryBreakdown,
  } = input;

  // Keep the meaningful sources named and roll the long tail into "Others", so
  // the ring stays readable instead of fraying into 1% slivers.
  const MIN_DONUT_SHARE = 2.5;
  const allSources = aggregateBySource(categoryBreakdown).filter((s) => s.share > 0);
  // Leftover "other" joins the small-source tail so the ring never shows
  // both "Other" and "Others".
  const named = allSources.filter((s) => s.key !== "other" && s.share >= MIN_DONUT_SHARE);
  const tail = allSources.filter((s) => s.key === "other" || s.share < MIN_DONUT_SHARE);
  const tailShare = tail.reduce((sum, s) => sum + s.share, 0);
  const tailPoints = tail.reduce((sum, s) => sum + s.points, 0);

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

  // Size tiers keep the old names. The Aura column is the exclusive numeric
  // band for that row — not a second name and not a dollar size.
  const at = (i: number) => depositSizeDistribution[i] ?? EMPTY_BUCKET;
  const megalodon = mergeBuckets(depositSizeDistribution.slice(5));
  const sizeTiers = [
    { id: "snowflake", label: "Snowflake (<$100)", bucket: at(0) },
    { id: "bulker", label: "Bulker ($100-1K)", bucket: at(1) },
    { id: "lilYeti", label: "Lil Yeti ($1K-10K)", bucket: at(2) },
    { id: "bulkingYeti", label: "Bulking Yeti ($10K-100K)", bucket: at(3) },
    { id: "auramaxer", label: "Auramaxer ($100K-500K)", bucket: at(4) },
    { id: "megalodon", label: "Megalodon ($500K+)", bucket: megalodon },
  ] as const;
  const tierDefs = sizeTiers.map((t, i) => ({
    id: t.id,
    label: t.label,
    ...t.bucket,
    rangeLabel: DEPOSITOR_AURA_RANGES[i].label.replace(/\s+AURA$/i, ""),
    color: chartPrimaryRamp(i, sizeTiers.length),
  }));

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
  const tierAuraTotal = tierDefs.reduce((sum, t) => sum + t.aura, 0);
  const tierBase = tierCountTotal > 0 ? tierCountTotal : 1;
  const heldBase = tierHeldTotal > 0 ? tierHeldTotal : 1;
  const auraBase = tierAuraTotal > 0 ? tierAuraTotal : 1;
  const tiers: DepositTier[] = tierDefs.map((t) => ({
    ...t,
    pct: (t.count / tierBase) * 100,
    heldPct: (t.held / heldBase) * 100,
    avgHeld: t.count > 0 ? t.held / t.count : 0,
    auraPct: (t.aura / auraBase) * 100,
    avgAura: t.count > 0 ? t.aura / t.count : 0,
    auraRange: t.rangeLabel,
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

  return { auraSources, depositorsAnalysis };
}
