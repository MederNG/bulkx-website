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

/** 85% of the ~1M weekly Aura distribution allocated to deposit holding. */
export const WEEKLY_DEPOSIT_AURA_POOL = 850_000;

/** Observed TVL at Sat 13:00 UTC snapshot for completed campaign weeks. */
export const CAMPAIGN_WEEK_TVL_SNAPSHOT: Record<number, number> = {
  1: 21_000_000,
  2: 30_000_000,
  3: 40_600_000,
};

/** Effective share of TVL×hours that becomes cohort USD-hours (backtested W1–W3 Jun 2026). */
export const COHORT_USD_HOURS_FACTOR = 0.68;

/** @deprecated Use {@link COHORT_USD_HOURS_FACTOR} — marginal/continuing split removed. */
export const COHORT_USD_HOURS_FACTOR_MARGINAL = COHORT_USD_HOURS_FACTOR;

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
  _entries: LeaderboardEntry[],
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
  const snapshotTvl = weekTvl[campaignWeek] ?? currentTvl;

  return {
    campaignWeek,
    depositPool: WEEKLY_DEPOSIT_AURA_POOL,
    hoursUntilSnapshot,
    hoursInWeek,
    cohortUsdHoursAtSnapshot: computeCohortUsdHoursAtSnapshot(
      snapshotTvl,
      hoursInWeek,
      COHORT_USD_HOURS_FACTOR
    ),
    nextSnapshotTimestamp,
    snapshotLabel: formatSnapshotUtc(nextSnapshotTimestamp),
    currentWeekWindow: formatCampaignWeekWindow(campaignWeek),
    currentTvl,
    weekTvl,
  };
}

export function predictDepositAura(
  deposit: number,
  context: Pick<
    DepositAuraPredictContext,
    | "depositPool"
    | "cohortUsdHoursAtSnapshot"
    | "hoursUntilSnapshot"
    | "hoursInWeek"
    | "campaignWeek"
    | "weekTvl"
  >,
  options: PredictDepositAuraOptions = {}
): DepositAuraPrediction {
  const holdSinceWeek = options.holdSinceWeek ?? null;

  if (holdSinceWeek != null && holdSinceWeek > 0) {
    return predictCumulativeHoldSince(deposit, holdSinceWeek, context);
  }

  const mode = options.mode ?? "new_deposit";
  const userUsdHours = computeUserWeekUsdHours(deposit, context, mode);

  if (deposit <= 0 || userUsdHours <= 0) {
    return {
      predictedAura: 0,
      userUsdHours: 0,
      totalUsdHours: context.cohortUsdHoursAtSnapshot,
      poolSharePct: 0,
      efficiency: 0,
    };
  }

  // Marginal deposit: user USD-hours are not yet in snapshot TVL cohort.
  // Full-week / continuing holder: balance is already represented in TVL × factor.
  const totalUsdHours =
    mode === "new_deposit"
      ? context.cohortUsdHoursAtSnapshot + userUsdHours
      : context.cohortUsdHoursAtSnapshot;
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

/** Cumulative deposit Aura if holding the same balance every week since Week N. */
function predictCumulativeHoldSince(
  deposit: number,
  holdSinceWeek: number,
  context: Pick<
    DepositAuraPredictContext,
    "depositPool" | "hoursInWeek" | "hoursUntilSnapshot" | "campaignWeek" | "weekTvl"
  >
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
  let userUsdHours = 0;
  let totalUsdHours = 0;

  for (let week = holdSinceWeek; week <= context.campaignWeek; week += 1) {
    const inProgress = week === context.campaignWeek;
    const weekHours = resolveHoldSinceWeekHours(week, context);
    const weekUserUsdHours = deposit * weekHours;
    const weekTvl = context.weekTvl[week] ?? context.weekTvl[context.campaignWeek];
    const weekTotalUsdHours = computeCohortUsdHoursAtSnapshot(
      weekTvl,
      weekHours,
      COHORT_USD_HOURS_FACTOR
    );
    const weekAura =
      weekTotalUsdHours > 0
        ? (weekUserUsdHours / weekTotalUsdHours) * context.depositPool
        : 0;

    weekBreakdown.push({
      week,
      aura: weekAura,
      userUsdHours: weekUserUsdHours,
      hoursInPeriod: weekHours,
      inProgress,
    });
    predictedAura += weekAura;
    userUsdHours += weekUserUsdHours;
    totalUsdHours += weekTotalUsdHours;
  }

  const avgPoolShare =
    weekBreakdown.length > 0
      ? weekBreakdown.reduce(
          (sum, row) => {
            const cohort = computeCohortUsdHoursAtSnapshot(
              context.weekTvl[row.week] ?? 0,
              row.hoursInPeriod,
              COHORT_USD_HOURS_FACTOR
            );
            return sum + (cohort > 0 ? (row.userUsdHours / cohort) * 100 : 0);
          },
          0
        ) / weekBreakdown.length
      : 0;

  return {
    predictedAura,
    userUsdHours,
    totalUsdHours,
    poolSharePct: avgPoolShare,
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
