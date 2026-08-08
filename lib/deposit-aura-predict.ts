import type { LeaderboardEntry, Snapshot } from "@/types";
import {
  formatSnapshotUtc,
  getNextSnapshotTimestamp,
  getPreviousSnapshotTimestamp,
} from "@/lib/projected-snapshot-tvl";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Campaign launch — start of Week 1 (partial week until first snapshot). */
export const CAMPAIGN_LAUNCH_MS = Date.parse("2026-06-01T00:00:00.000Z");

/** First Sat 13:00 UTC snapshot — end of Week 1; Week 2+ are Sat→Sat. */
export const CAMPAIGN_WEEK1_SNAPSHOT_MS = Date.parse("2026-06-06T13:00:00.000Z");

/**
 * Fallback weekly deposit-Aura pool, used only when the leaderboard has no
 * completed week to measure. The live value is measured per week from actual
 * payouts — see {@link measureWeeklyAuraPool}.
 */
export const WEEKLY_DEPOSIT_AURA_POOL = 940_000;

/** Observed TVL at Sat 13:00 UTC snapshot for completed campaign weeks. */
export const CAMPAIGN_WEEK_TVL_SNAPSHOT: Record<number, number> = {
  1: 21_000_000,
  2: 30_000_000,
  3: 40_600_000,
};

/**
 * Share of snapshot TVL that actually earns deposit Aura, used only as a
 * fallback when the earning cohort can't be measured from the leaderboard.
 * Historically this drifted badly (0.68 in Jun 2026 → ~0.99 by Aug 2026), which
 * is why the live path measures the cohort directly instead of scaling TVL.
 */
export const COHORT_USD_HOURS_FACTOR = 0.99;

/** @deprecated Use {@link COHORT_USD_HOURS_FACTOR} — marginal/continuing split removed. */
export const COHORT_USD_HOURS_FACTOR_MARGINAL = COHORT_USD_HOURS_FACTOR;

/** Ignore dust balances when sampling wallets for calibration. */
const RATE_SAMPLE_MIN_BALANCE = 500;

/** Aura is reported as whole numbers, so tiny payouts are mostly rounding. */
const RATE_SAMPLE_MIN_AURA = 5;

/** Raw `weekN` category key — the base deposit-holding pool (excludes protocol/referral bonuses). */
function weekAuraKey(week: number): string {
  return `week${week}`;
}

/** Total base deposit Aura actually distributed in a completed campaign week. */
export function measureWeeklyAuraPool(entries: LeaderboardEntry[], week: number): number {
  const key = weekAuraKey(week);
  let pool = 0;
  for (const entry of entries) {
    pool += entry.categories?.[key] ?? 0;
  }
  return pool;
}

/**
 * Eligible cumulative USD-hours at a completed week's snapshot, measured
 * directly rather than extrapolated.
 *
 * Inverts the payout formula on wallets whose balance never changed: their
 * tenure (`total_held_time_hours / balance`) says exactly how many USD-hours
 * they had accrued by that week, and their realised Aura then pins down the
 * denominator the pool was divided across. Taking the median over thousands of
 * such wallets makes this robust to individual noise.
 *
 * This matters because wallets that have since withdrawn to zero were still
 * eligible back then — an estimate scaled from today's survivors alone would
 * understate the older weeks' denominators and overstate their payouts.
 */
export function measureWeekEligibleCumUsdHours(
  entries: LeaderboardEntry[],
  week: number,
  pool: number,
  nowMs: number
): number | null {
  if (pool <= 0) return null;

  const key = weekAuraKey(week);
  const weekEndMs = getCampaignWeekEndMs(week);
  const samples: number[] = [];

  for (const entry of entries) {
    // Any withdrawal breaks the constant-balance assumption behind the tenure math.
    if (entry.withdrawn_amount > 0) continue;
    if (entry.current_amount < RATE_SAMPLE_MIN_BALANCE) continue;

    const aura = entry.categories?.[key] ?? 0;
    if (aura < RATE_SAMPLE_MIN_AURA) continue;

    const accrued = entry.total_held_time_hours ?? 0;
    if (accrued <= 0) continue;

    const tenureHours = accrued / entry.current_amount;
    const depositedAtMs = nowMs - tenureHours * MS_PER_HOUR;
    const heldHours = (weekEndMs - depositedAtMs) / MS_PER_HOUR;
    if (heldHours <= 0) continue;

    const cumUsdHours = entry.current_amount * heldHours;
    samples.push((pool * cumUsdHours) / aura);
  }

  if (samples.length < 20) return null;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * Cumulative USD-hours still eligible for Aura.
 *
 * Weekly Aura is split pro-rata on *lifetime* USD-hours, not just the current
 * week's — which is why a long-tenured wallet earns several times more per
 * dollar than one that deposited recently. Wallets that have withdrawn to zero
 * forfeit everything they accrued, so they are excluded from the denominator.
 */
export function measureEligibleCumulativeUsdHours(entries: LeaderboardEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.current_amount > 0) {
      total += entry.total_held_time_hours ?? 0;
    }
  }
  return total;
}

/**
 * TVL integrated over time — the shape of how cumulative USD-hours built up.
 *
 * Snapshots only start part-way into the campaign, so the early anchors in
 * {@link CAMPAIGN_WEEK_TVL_SNAPSHOT} fill the gap back to launch. The absolute
 * level is later pinned to the measured eligible total, so this only has to get
 * the shape right.
 */
function buildTvlCurve(snapshots: Snapshot[]): { t: number; tvl: number }[] {
  const points: { t: number; tvl: number }[] = [{ t: CAMPAIGN_LAUNCH_MS, tvl: 0 }];

  for (const [week, tvl] of Object.entries(CAMPAIGN_WEEK_TVL_SNAPSHOT)) {
    points.push({ t: getCampaignWeekEndMs(Number(week)), tvl });
  }

  for (const snap of snapshots) {
    const t = Date.parse(snap.timestamp);
    if (Number.isFinite(t)) points.push({ t, tvl: snap.tvl });
  }

  points.sort((a, b) => a.t - b.t);

  // Drop anchors superseded by a real snapshot at the same moment.
  return points.filter((p, i) => i === 0 || p.t !== points[i - 1].t);
}

/** Trapezoidal integral of TVL from campaign launch to `untilMs`, in USD-hours. */
function integrateTvl(curve: { t: number; tvl: number }[], untilMs: number): number {
  let area = 0;

  for (let i = 1; i < curve.length; i += 1) {
    const prev = curve[i - 1];
    const cur = curve[i];
    if (cur.t <= untilMs) {
      area += ((prev.tvl + cur.tvl) / 2) * ((cur.t - prev.t) / MS_PER_HOUR);
      continue;
    }
    if (prev.t < untilMs) {
      const fraction = (untilMs - prev.t) / (cur.t - prev.t);
      const tvlAt = prev.tvl + (cur.tvl - prev.tvl) * fraction;
      area += ((prev.tvl + tvlAt) / 2) * ((untilMs - prev.t) / MS_PER_HOUR);
    }
    break;
  }

  // Past the last known point, carry the final TVL forward.
  const last = curve[curve.length - 1];
  if (last && untilMs > last.t) {
    area += last.tvl * ((untilMs - last.t) / MS_PER_HOUR);
  }

  return area;
}

export type DepositPredictMode = "new_deposit" | "full_week_hold";

export interface DepositAuraPredictContext {
  campaignWeek: number;
  depositPool: number;
  hoursUntilSnapshot: number;
  hoursInWeek: number;
  cohortUsdHoursAtSnapshot: number;
  nextSnapshotTimestamp: number;
  snapshotLabel: string;
  /** Week window for the active campaign week (W1: launch → first snapshot). */
  currentWeekWindow: string;
  currentTvl: number;
  /** TVL anchor per campaign week (for Hold since Week N). */
  weekTvl: Record<number, number>;
  /** Base deposit Aura actually paid out, per completed campaign week. */
  weekPool: Record<number, number>;
  /**
   * Eligible cumulative USD-hours at the end of each campaign week — the
   * denominator every week's pool is split across.
   */
  weekEligibleCumUsdHours: Record<number, number>;
  /** Eligible cumulative USD-hours at the upcoming snapshot. */
  eligibleCumUsdHoursAtSnapshot: number;
  /** How the live numbers were derived — surfaced for transparency in the UI. */
  calibration: {
    /** Last campaign week with a settled snapshot, or null before the first. */
    lastCompletedWeek: number | null;
    /** Base deposit Aura distributed in that week. */
    measuredPool: number | null;
    /** Cumulative USD-hours still eligible (wallets at $0 forfeit theirs). */
    eligibleCumUsdHours: number | null;
    /** Share of all accrued USD-hours that has not been forfeited. */
    liveShare: number | null;
    /** False when falling back to constants because data was unavailable. */
    isCalibrated: boolean;
  };
}

export interface PredictDepositAuraOptions {
  mode?: DepositPredictMode;
  /** Continuous holder since campaign Week N — cumulative deposit Aura through current week. */
  holdSinceWeek?: number | null;
}

export interface HoldSinceWeekBreakdown {
  week: number;
  aura: number;
  userUsdHours: number;
  /** Hours credited in this week's snapshot window. */
  hoursInPeriod: number;
  /** True for the in-progress campaign week (snapshot not taken yet). */
  inProgress: boolean;
}

export interface DepositAuraPrediction {
  predictedAura: number;
  userUsdHours: number;
  totalUsdHours: number;
  poolSharePct: number;
  efficiency: number;
  /** Per-week deposit Aura when Hold since is active. */
  weekBreakdown?: HoldSinceWeekBreakdown[];
}

export function getCampaignWeek1StartMs(): number {
  return CAMPAIGN_LAUNCH_MS;
}

/** Campaign Week N start (W1 = Jun 1 launch; W2+ = Sat 13:00 UTC snapshots). */
export function getCampaignWeekStartMs(week: number): number {
  if (week <= 1) return CAMPAIGN_LAUNCH_MS;
  return CAMPAIGN_WEEK1_SNAPSHOT_MS + (week - 2) * MS_PER_WEEK;
}

/** Campaign Week N end (W1 = first snapshot; W2+ = next Sat 13:00 UTC). */
export function getCampaignWeekEndMs(week: number): number {
  if (week === 1) return CAMPAIGN_WEEK1_SNAPSHOT_MS;
  return getCampaignWeekStartMs(week) + MS_PER_WEEK;
}

export function getCampaignWeekHours(week: number): number {
  return (getCampaignWeekEndMs(week) - getCampaignWeekStartMs(week)) / MS_PER_HOUR;
}

function formatCampaignLaunchUtc(timestampMs: number): string {
  const date = new Date(timestampMs).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${date}, 00:00 UTC`;
}

export function formatCampaignWeekWindow(week: number): string {
  const startMs = getCampaignWeekStartMs(week);
  const startLabel =
    week === 1 ? formatCampaignLaunchUtc(startMs) : formatSnapshotUtc(startMs);
  return `${startLabel} → ${formatSnapshotUtc(getCampaignWeekEndMs(week))}`;
}

/** TVL at Sat 13:00 UTC snapshot for campaign Week N. */
export function resolveWeekTvl(
  week: number,
  currentWeek: number,
  currentTvl: number,
  snapshots: Snapshot[]
): number {
  const anchored = CAMPAIGN_WEEK_TVL_SNAPSHOT[week];
  if (anchored != null && week < currentWeek) {
    return anchored;
  }

  if (week >= currentWeek) return currentTvl;

  const targetMs = getCampaignWeekEndMs(week);
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (!sorted.length) return currentTvl;

  const WEEKLY_TVL_GROWTH = 1.025;

  for (const snap of sorted) {
    const ts = new Date(snap.timestamp).getTime();
    if (ts >= targetMs && ts - targetMs <= 7 * MS_PER_DAY) {
      return snap.tvl;
    }
  }

  const earliest = sorted[0];
  const earliestMs = new Date(earliest.timestamp).getTime();
  if (targetMs < earliestMs) {
    const weeksAfterTarget = (earliestMs - targetMs) / MS_PER_WEEK;
    return earliest.tvl / Math.pow(WEEKLY_TVL_GROWTH, weeksAfterTarget);
  }

  const nearest = sorted.reduce<{ tvl: number; delta: number } | null>((best, snap) => {
    const delta = Math.abs(new Date(snap.timestamp).getTime() - targetMs);
    if (!best || delta < best.delta) return { tvl: snap.tvl, delta };
    return best;
  }, null);

  return nearest?.tvl ?? currentTvl;
}

export function buildWeekTvlMap(
  currentWeek: number,
  currentTvl: number,
  snapshots: Snapshot[]
): Record<number, number> {
  const map: Record<number, number> = {};
  for (let week = 1; week <= currentWeek; week += 1) {
    map[week] = resolveWeekTvl(week, currentWeek, currentTvl, snapshots);
  }
  return map;
}

/** Active campaign week (W1 from Jun 1 → Jun 6 snapshot; W2+ Sat→Sat). */
export function getCurrentCampaignWeek(nowMs: number = Date.now()): number {
  if (nowMs < CAMPAIGN_LAUNCH_MS) return 1;
  if (nowMs < CAMPAIGN_WEEK1_SNAPSHOT_MS) return 1;
  return 2 + Math.floor((nowMs - CAMPAIGN_WEEK1_SNAPSHOT_MS) / MS_PER_WEEK);
}

export function computeCohortUsdHoursAtSnapshot(
  currentTvl: number,
  hoursInWeek: number,
  factor: number = COHORT_USD_HOURS_FACTOR
): number {
  return currentTvl * hoursInWeek * factor;
}

export function computeUserWeekUsdHours(
  deposit: number,
  context: Pick<DepositAuraPredictContext, "hoursInWeek" | "hoursUntilSnapshot">,
  mode: DepositPredictMode
): number {
  if (deposit <= 0) return 0;

  if (mode === "new_deposit") {
    return deposit * context.hoursUntilSnapshot;
  }

  return deposit * context.hoursInWeek;
}

/**
 * Hours in a hold-since week window (Sat 13:00 UTC → Sat 13:00 UTC).
 * Completed weeks use the full snapshot period; the current week uses elapsed + remaining hours.
 */
export function resolveHoldSinceWeekHours(
  week: number,
  context: Pick<DepositAuraPredictContext, "campaignWeek" | "hoursInWeek" | "hoursUntilSnapshot">
): number {
  if (week < context.campaignWeek) {
    return getCampaignWeekHours(week);
  }

  const hoursElapsed = Math.max(0, context.hoursInWeek - context.hoursUntilSnapshot);
  return hoursElapsed + context.hoursUntilSnapshot;
}

export function computeDepositAuraPredictContext(
  entries: LeaderboardEntry[],
  currentTvl: number,
  nowMs: number = Date.now(),
  snapshots: Snapshot[] = []
): DepositAuraPredictContext {
  const nextSnapshotTimestamp = getNextSnapshotTimestamp(nowMs);
  const previousSnapshotTimestamp = getPreviousSnapshotTimestamp(nextSnapshotTimestamp);
  const hoursUntilSnapshot = Math.max(0, (nextSnapshotTimestamp - nowMs) / MS_PER_HOUR);
  const hoursInWeek = (nextSnapshotTimestamp - previousSnapshotTimestamp) / MS_PER_HOUR;
  const campaignWeek = getCurrentCampaignWeek(nowMs);
  const weekTvl = buildWeekTvlMap(campaignWeek, currentTvl, snapshots);
  const lastCompletedWeek = campaignWeek > 1 ? campaignWeek - 1 : null;

  // `total_held_time_hours` is accurate as of when the leaderboard was fetched,
  // not when the page is viewed. Anchor tenure maths to the data's own clock so
  // a stale render can't inflate everyone's implied deposit date.
  const latestSnapshotMs = snapshots.reduce((latest, snap) => {
    const t = Date.parse(snap.timestamp);
    return Number.isFinite(t) && t > latest ? t : latest;
  }, 0);
  const dataAsOfMs = latestSnapshotMs > 0 ? Math.min(latestSnapshotMs, nowMs) : nowMs;

  // Measured denominator: lifetime USD-hours still eligible right now.
  const eligibleNow = measureEligibleCumulativeUsdHours(entries);
  const accruedAll = entries.reduce((sum, e) => sum + (e.total_held_time_hours ?? 0), 0);
  const liveShare = accruedAll > 0 ? eligibleNow / accruedAll : null;

  // The TVL integral supplies the shape of how that total built up; its level is
  // pinned to the measured value so snapshot gaps can't skew it.
  const curve = buildTvlCurve(snapshots);
  const integralNow = integrateTvl(curve, dataAsOfMs);
  const scale = eligibleNow > 0 && integralNow > 0 ? eligibleNow / integralNow : null;

  const eligibleAt = (timestampMs: number): number => {
    if (scale != null) return integrateTvl(curve, timestampMs) * scale;
    // No leaderboard tenure data — fall back to a flat TVL cohort.
    return currentTvl * COHORT_USD_HOURS_FACTOR * hoursInWeek;
  };

  const weekPool: Record<number, number> = {};
  const weekEligibleCumUsdHours: Record<number, number> = {};
  for (let week = 1; week <= campaignWeek; week += 1) {
    const pool = week <= (lastCompletedWeek ?? 0) ? measureWeeklyAuraPool(entries, week) : 0;
    if (pool > 0) weekPool[week] = pool;

    // Prefer the denominator implied by that week's actual payouts; the TVL
    // integral is only a fallback for weeks with too few usable samples.
    const measured =
      pool > 0 ? measureWeekEligibleCumUsdHours(entries, week, pool, dataAsOfMs) : null;
    weekEligibleCumUsdHours[week] = measured ?? eligibleAt(getCampaignWeekEndMs(week));
  }

  const measuredPool =
    lastCompletedWeek != null ? (weekPool[lastCompletedWeek] ?? null) : null;
  const depositPool = measuredPool ?? WEEKLY_DEPOSIT_AURA_POOL;

  // Everyone still holding keeps accruing until the snapshot lands.
  const eligibleCumUsdHoursAtSnapshot =
    scale != null
      ? eligibleNow + currentTvl * hoursUntilSnapshot
      : currentTvl * COHORT_USD_HOURS_FACTOR * hoursInWeek;

  weekEligibleCumUsdHours[campaignWeek] = eligibleCumUsdHoursAtSnapshot;

  return {
    campaignWeek,
    depositPool,
    hoursUntilSnapshot,
    hoursInWeek,
    cohortUsdHoursAtSnapshot: eligibleCumUsdHoursAtSnapshot,
    nextSnapshotTimestamp,
    snapshotLabel: formatSnapshotUtc(nextSnapshotTimestamp),
    currentWeekWindow: formatCampaignWeekWindow(campaignWeek),
    currentTvl,
    weekTvl,
    weekPool,
    weekEligibleCumUsdHours,
    eligibleCumUsdHoursAtSnapshot,
    calibration: {
      lastCompletedWeek,
      measuredPool,
      eligibleCumUsdHours: eligibleNow > 0 ? eligibleNow : null,
      liveShare,
      isCalibrated: scale != null && measuredPool != null,
    },
  };
}

type PredictContext = Pick<
  DepositAuraPredictContext,
  | "depositPool"
  | "cohortUsdHoursAtSnapshot"
  | "hoursUntilSnapshot"
  | "hoursInWeek"
  | "campaignWeek"
  | "weekTvl"
  | "weekPool"
  | "weekEligibleCumUsdHours"
  | "eligibleCumUsdHoursAtSnapshot"
>;

export function predictDepositAura(
  deposit: number,
  context: PredictContext,
  options: PredictDepositAuraOptions = {}
): DepositAuraPrediction {
  const holdSinceWeek = options.holdSinceWeek ?? null;

  if (holdSinceWeek != null && holdSinceWeek > 0) {
    return predictCumulativeHoldSince(deposit, holdSinceWeek, context);
  }

  const mode = options.mode ?? "new_deposit";
  // Lifetime USD-hours this deposit will have accrued by the snapshot. A brand
  // new deposit starts from zero, which is why it earns far less than an
  // established position of the same size.
  const userUsdHours = computeUserWeekUsdHours(deposit, context, mode);

  if (deposit <= 0 || userUsdHours <= 0) {
    return {
      predictedAura: 0,
      userUsdHours: 0,
      totalUsdHours: context.eligibleCumUsdHoursAtSnapshot,
      poolSharePct: 0,
      efficiency: 0,
    };
  }

  // New money is not yet inside the measured cohort, so it enlarges it.
  const totalUsdHours = context.eligibleCumUsdHoursAtSnapshot + userUsdHours;
  const predictedAura =
    totalUsdHours > 0 ? (userUsdHours / totalUsdHours) * context.depositPool : 0;

  return {
    predictedAura,
    userUsdHours,
    totalUsdHours,
    poolSharePct: totalUsdHours > 0 ? (userUsdHours / totalUsdHours) * 100 : 0,
    efficiency: deposit > 0 ? predictedAura / deposit : 0,
  };
}

/**
 * Cumulative deposit Aura if the same balance were held every week since Week N.
 *
 * Completed weeks use that week's realised Aura-per-dollar, so those rows are
 * what the wallet would actually have been paid — not a model estimate.
 */
function predictCumulativeHoldSince(
  deposit: number,
  holdSinceWeek: number,
  context: PredictContext
): DepositAuraPrediction {
  if (deposit <= 0) {
    return {
      predictedAura: 0,
      userUsdHours: 0,
      totalUsdHours: 0,
      poolSharePct: 0,
      efficiency: 0,
      weekBreakdown: [],
    };
  }

  const weekBreakdown: HoldSinceWeekBreakdown[] = [];
  let predictedAura = 0;
  let poolShareSum = 0;
  let cumulativeUsdHours = 0;

  const holdStartMs = getCampaignWeekStartMs(holdSinceWeek);

  for (let week = holdSinceWeek; week <= context.campaignWeek; week += 1) {
    const inProgress = week === context.campaignWeek;
    const weekHours = resolveHoldSinceWeekHours(week, context);

    // Lifetime USD-hours accrued by the end of this week — the basis each
    // week's pool is split on. It grows every week, which is why a steady
    // balance earns progressively more.
    const hoursSinceHoldStart = Math.max(
      0,
      (getCampaignWeekEndMs(week) - holdStartMs) / MS_PER_HOUR
    );
    cumulativeUsdHours = deposit * hoursSinceHoldStart;

    const pool = context.weekPool?.[week] ?? context.depositPool;
    const eligible =
      context.weekEligibleCumUsdHours?.[week] ?? context.eligibleCumUsdHoursAtSnapshot;
    const denominator = eligible + cumulativeUsdHours;

    const weekAura = denominator > 0 ? (cumulativeUsdHours / denominator) * pool : 0;

    weekBreakdown.push({
      week,
      aura: weekAura,
      userUsdHours: cumulativeUsdHours,
      hoursInPeriod: weekHours,
      inProgress,
    });
    predictedAura += weekAura;
    poolShareSum += denominator > 0 ? (cumulativeUsdHours / denominator) * 100 : 0;
  }

  return {
    predictedAura,
    userUsdHours: cumulativeUsdHours,
    totalUsdHours: context.eligibleCumUsdHoursAtSnapshot,
    poolSharePct: weekBreakdown.length > 0 ? poolShareSum / weekBreakdown.length : 0,
    efficiency: deposit > 0 ? predictedAura / deposit : 0,
    weekBreakdown,
  };
}

/** Back-test helper: integrate USD-hours from deposit/withdraw events in a week window. */
export function usdHoursFromEvents(
  events: { ts: number; type: "deposit" | "withdraw"; amount: number }[],
  periodStart: number,
  periodEnd: number
): number {
  let balance = 0;
  let totalUsdHours = 0;
  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  for (const e of sorted) {
    if (e.ts >= periodStart) break;
    balance += e.type === "deposit" ? e.amount : -e.amount;
  }

  let cursor = periodStart;
  for (const e of sorted.filter((ev) => ev.ts >= periodStart && ev.ts < periodEnd)) {
    const hours = (e.ts - cursor) / 3_600_000;
    if (balance > 0 && hours > 0) totalUsdHours += balance * hours;
    balance += e.type === "deposit" ? e.amount : -e.amount;
    cursor = e.ts;
  }

  const finalHours = (periodEnd - cursor) / 3_600_000;
  if (balance > 0 && finalHours > 0) totalUsdHours += balance * finalHours;

  return totalUsdHours;
}

export function predictFromCalibratedCohort(
  userUsdHours: number,
  cohortUsdHours: number,
  depositPool = WEEKLY_DEPOSIT_AURA_POOL
): number {
  if (userUsdHours <= 0 || cohortUsdHours <= 0) return 0;
  return (userUsdHours / cohortUsdHours) * depositPool;
}
