export type LevelPoint = { t: number; value: number };

/** Same 1h step as the volume 24h spark (klines are hourly). */
export const LEVEL_SAMPLE_MS = 3_600_000;
export const LEVEL_KEEP_MS = 86_400_000;
export const LEVEL_MAX_POINTS = 24;
/** Keep a point on the far side of the 24h window so the unique delta is real. */
export const UNIQUE_KEEP_MS = 30 * 3_600_000;
export const UNIQUE_MAX_POINTS = 30;
const UNIQUE_WINDOW_MS = 86_400_000;
const UNIQUE_BASELINE_SLACK_MS = 30 * 60_000;

export function bucketLevelTime(t: number): number {
  return Math.floor(t / LEVEL_SAMPLE_MS) * LEVEL_SAMPLE_MS;
}

export function mergeLevelPoints(...lists: LevelPoint[][]): LevelPoint[] {
  const byTime = new Map<number, number>();
  const cutoff = Date.now() - LEVEL_KEEP_MS;
  for (const list of lists) {
    for (const row of list) {
      if (!Number.isFinite(row.value) || row.t < cutoff) continue;
      byTime.set(bucketLevelTime(row.t), row.value);
    }
  }
  const rows = [...byTime.entries()]
    .map(([t, value]) => ({ t, value }))
    .sort((a, b) => a.t - b.t);
  return rows.length > LEVEL_MAX_POINTS ? rows.slice(-LEVEL_MAX_POINTS) : rows;
}

/** Monotonic counter samples (unique submissions), hourly buckets. */
export function mergeCounterPoints(...lists: LevelPoint[][]): LevelPoint[] {
  const byTime = new Map<number, number>();
  const cutoff = Date.now() - UNIQUE_KEEP_MS;
  for (const list of lists) {
    for (const row of list) {
      if (!Number.isFinite(row.value) || row.value < 0 || row.t < cutoff) continue;
      byTime.set(bucketLevelTime(row.t), row.value);
    }
  }
  const rows = [...byTime.entries()]
    .map(([t, value]) => ({ t, value }))
    .sort((a, b) => a.t - b.t);
  return rows.length > UNIQUE_MAX_POINTS ? rows.slice(-UNIQUE_MAX_POINTS) : rows;
}

/**
 * Unique submissions in the last 24h. Candle `n` is not this — it stays
 * thousands per minute even when volume is 0 (orders/ticks, not fills).
 * Returns 0 until a sample older than ~23.5h exists; do not extrapolate.
 */
export function uniqueCount24h(points: LevelPoint[], current: number, now = Date.now()): number {
  if (!(current > 0)) return 0;
  const target = now - UNIQUE_WINDOW_MS;
  let baseline: LevelPoint | null = null;
  for (const row of points) {
    if (!(row.value > 0) || row.t > target + UNIQUE_BASELINE_SLACK_MS) continue;
    if (!baseline || row.t > baseline.t) baseline = row;
  }
  if (!baseline || current < baseline.value) return 0;
  return current - baseline.value;
}
