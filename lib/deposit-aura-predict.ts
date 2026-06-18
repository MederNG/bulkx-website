import type { LeaderboardEntry, Snapshot } from "@/types";
import {
  formatSnapshotUtc,
  getNextSnapshotTimestamp,
  getPreviousSnapshotTimestamp,
} from "@/lib/projected-snapshot-tvl";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Week-1 snapshot (Sat 13:00 UTC) — anchor for campaign week numbering. */
const CAMPAIGN_WEEK1_SNAPSHOT_MS = Date.parse("2026-06-06T13:00:00.000Z");

/** 85% of the ~1M weekly Aura distribution allocated to deposit holding. */
export const WEEKLY_DEPOSIT_AURA_POOL = 850_000;

/** Calibrated from on-chain deposit timelines (Jun 2026 Week 1/2 snapshots).
 * Cohort USD-hours ≈ TVL × week_hours × factor (not all TVL held the full week).
 */
export const COHORT_USD_HOURS_FACTOR = 0.54;

export type DepositPredictMode = "new_deposit" | "full_week_hold";

export interface DepositAuraPredictContext {
  campaignWeek: number;
  depositPool: number;
  hoursUntilSnapshot: number;
  hoursInWeek: number;
  cohortUsdHoursAtSnapshot: number;
  nextSnapshotTimestamp: number;
  snapshotLabel: string;
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
  return getPreviousSnapshotTimestamp(CAMPAIGN_WEEK1_SNAPSHOT_MS);
}

export function getCampaignWeekEndMs(week: number): number {
  return getCampaignWeek1StartMs() + week * MS_PER_WEEK;
}

/** TVL at or just after the Week N snapshot boundary. */
export function resolveWeekTvl(
  week: number,
  currentWeek: number,
  currentTvl: number,
  snapshots: Snapshot[]
): number {
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

/** Current campaign week from the weekly snapshot calendar (not leaderboard category keys). */
export function getCurrentCampaignWeek(nowMs: number = Date.now()): number {
  const week1Start = getCampaignWeek1StartMs();
  if (nowMs < week1Start) return 1;
  return Math.floor((nowMs - week1Start) / MS_PER_WEEK) + 1;
}

export function computeCohortUsdHoursAtSnapshot(
  currentTvl: number,
  hoursInWeek: number
): number {
  return currentTvl * hoursInWeek * COHORT_USD_HOURS_FACTOR;
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
 * Hours in a hold-since week window.
 * Completed weeks use the full snapshot-to-snapshot period; the current week uses
 * elapsed time plus remaining hours until the upcoming snapshot (not a full 168h upfront).
 */
export function resolveHoldSinceWeekHours(
  week: number,
  context: Pick<DepositAuraPredictContext, "campaignWeek" | "hoursInWeek" | "hoursUntilSnapshot">
): number {
  if (week < context.campaignWeek) {
    return context.hoursInWeek;
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

  return {
    campaignWeek,
    depositPool: WEEKLY_DEPOSIT_AURA_POOL,
    hoursUntilSnapshot,
    hoursInWeek,
    cohortUsdHoursAtSnapshot: computeCohortUsdHoursAtSnapshot(currentTvl, hoursInWeek),
    nextSnapshotTimestamp,
    snapshotLabel: formatSnapshotUtc(nextSnapshotTimestamp),
    currentTvl,
    weekTvl: buildWeekTvlMap(campaignWeek, currentTvl, snapshots),
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

  const totalUsdHours = context.cohortUsdHoursAtSnapshot + userUsdHours;
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
    const weekCohortUsdHours = computeCohortUsdHoursAtSnapshot(weekTvl, weekHours);
    const alreadyInCohort = week > holdSinceWeek;
    const weekTotalUsdHours = alreadyInCohort
      ? weekCohortUsdHours
      : weekCohortUsdHours + weekUserUsdHours;
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
          (sum, row) =>
            sum +
            (row.userUsdHours /
              (computeCohortUsdHoursAtSnapshot(
                context.weekTvl[row.week] ?? 0,
                row.hoursInPeriod
              ) +
                (row.week > holdSinceWeek ? 0 : row.userUsdHours))) *
              100,
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
