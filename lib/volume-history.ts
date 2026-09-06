import { fetchExchangeStats, fetchKlines, marketBase, type ExchangeCandle } from "@/lib/bulk-exchange";

export const VOLUME_RANGES = ["1D", "W", "M", "Q", "Y", "ALL"] as const;
export type VolumeRange = (typeof VOLUME_RANGES)[number];

export const VOLUME_COINS = ["btc", "eth", "sol", "others"] as const;
export type VolumeCoin = (typeof VOLUME_COINS)[number];

export interface VolumeBucket {
  t: number;
  btc: number;
  eth: number;
  sol: number;
  others: number;
  total: number;
  cumulative: number;
}

export interface VolumeHistoryPayload {
  range: VolumeRange;
  interval: string;
  buckets: VolumeBucket[];
}

const RANGE_MS: Record<Exclude<VolumeRange, "ALL">, number> = {
  "1D": 24 * 3_600_000,
  W: 7 * 86_400_000,
  M: 30 * 86_400_000,
  Q: 90 * 86_400_000,
  Y: 365 * 86_400_000,
};

const RANGE_INTERVAL: Record<VolumeRange, string> = {
  "1D": "1h",
  W: "4h",
  M: "1d",
  Q: "1d",
  Y: "1w",
  ALL: "1d",
};

/** First hour with tradeable mainnet candles. */
const MAINNET_START_MS = Date.UTC(2026, 8, 1);

const NAMED: Record<string, VolumeCoin> = {
  BTC: "btc",
  ETH: "eth",
  SOL: "sol",
};

let historyCache: { key: string; at: number; data: VolumeHistoryPayload } | null = null;
const HISTORY_TTL_MS = 60_000;

function candleUsd(candle: ExchangeCandle): number {
  const close = Number(candle.c) || 0;
  const vol = Number(candle.v) || 0;
  if (!(close > 0) || !(vol > 0)) return 0;
  return close * vol;
}

function floorToInterval(t: number, interval: string): number {
  const ms =
    interval === "1h"
      ? 3_600_000
      : interval === "4h"
        ? 4 * 3_600_000
        : interval === "1d"
          ? 86_400_000
          : interval === "1w"
            ? 7 * 86_400_000
            : 3_600_000;
  return Math.floor(t / ms) * ms;
}

function coinForSymbol(symbol: string): VolumeCoin {
  return NAMED[marketBase(symbol)] ?? "others";
}

export async function buildVolumeHistory(range: VolumeRange): Promise<VolumeHistoryPayload> {
  const now = Date.now();
  if (historyCache && historyCache.key === range && now - historyCache.at < HISTORY_TTL_MS) {
    return historyCache.data;
  }

  const interval = RANGE_INTERVAL[range];
  const startTime = range === "ALL" ? undefined : now - RANGE_MS[range];
  const stats = await fetchExchangeStats();
  const symbols = (stats?.markets ?? [])
    .map((m) => m.symbol)
    .filter((s) => s && s !== "MEGA-USD");

  const series = await Promise.all(
    symbols.map(async (symbol) => ({
      symbol,
      candles: await fetchKlines(symbol, interval, startTime, now),
    })),
  );

  const byTime = new Map<number, VolumeBucket>();
  for (const { symbol, candles } of series) {
    const coin = coinForSymbol(symbol);
    for (const candle of candles) {
      const t = floorToInterval(Number(candle.t) || 0, interval);
      if (!t) continue;
      const usd = candleUsd(candle);
      if (!(usd > 0)) continue;
      const row =
        byTime.get(t) ??
        ({ t, btc: 0, eth: 0, sol: 0, others: 0, total: 0, cumulative: 0 } satisfies VolumeBucket);
      row[coin] += usd;
      byTime.set(t, row);
    }
  }

  const buckets = [...byTime.values()].sort((a, b) => a.t - b.t);
  let running = 0;
  for (const row of buckets) {
    row.total = row.btc + row.eth + row.sol + row.others;
    running += row.total;
    row.cumulative = running;
  }

  const data: VolumeHistoryPayload = { range, interval, buckets };
  historyCache = { key: range, at: now, data };
  return data;
}

const VOLUME_TTL_MS = 60_000;
let volumeCache: {
  at: number;
  volume24hUsd: number;
  volumeTotalUsd: number;
} | null = null;

async function marketSymbols(): Promise<string[]> {
  const stats = await fetchExchangeStats();
  return (stats?.markets ?? []).map((m) => m.symbol).filter((s) => s && s !== "MEGA-USD");
}

function sumCandlesUsd(candles: ExchangeCandle[], from?: number): number {
  let usd = 0;
  for (const candle of candles) {
    const t = Number(candle.t) || 0;
    if (from != null && t < from) continue;
    usd += candleUsd(candle);
  }
  return usd;
}

/**
 * Volume from klines only — `/stats`, `/ticker`, and ticker WS volume
 * fields are known-bad; candles are the exchange's conventional source.
 *
 * 24h = 1m candles. Total = 1h since trading mainnet opened plus that
 * same 24h 1m window, so all-time is never below the live 24h print.
 *
 * Do not sum candle `n` for trades: it stays thousands per minute even
 * when `v` is 0 (orders/ticks). Unique fills come from BulkStats
 * `/api/analytics/stats` `trades.count`.
 */
export async function sumCandleVolumes(): Promise<{
  volume24hUsd: number;
  volumeTotalUsd: number;
}> {
  const now = Date.now();
  if (volumeCache && now - volumeCache.at < VOLUME_TTL_MS) {
    return volumeCache;
  }

  const start24h = now - RANGE_MS["1D"];
  const symbols = await marketSymbols();
  const [minuteSeries, hourSeries] = await Promise.all([
    Promise.all(symbols.map((symbol) => fetchKlines(symbol, "1m", start24h, now))),
    Promise.all(symbols.map((symbol) => fetchKlines(symbol, "1h", MAINNET_START_MS, now))),
  ]);

  const volume24hUsd = minuteSeries.reduce((sum, candles) => sum + sumCandlesUsd(candles, start24h), 0);
  const olderUsd = hourSeries.reduce((sum, candles) => {
    let usd = 0;
    for (const candle of candles) {
      if ((Number(candle.t) || 0) < start24h) usd += candleUsd(candle);
    }
    return sum + usd;
  }, 0);

  const data = { at: now, volume24hUsd, volumeTotalUsd: olderUsd + volume24hUsd };
  volumeCache = data;
  return data;
}

/** Rolling 24h notional from 1m candles — same method as the exchange UI. */
export async function sumVolume24hFrom1m(): Promise<number> {
  return (await sumCandleVolumes()).volume24hUsd;
}

/** Hourly buckets from trading mainnet start — for the Total KPI spark. */
export async function buildAllTimeHourly(): Promise<VolumeHistoryPayload> {
  const now = Date.now();
  if (historyCache && historyCache.key === "ALL:1h" && now - historyCache.at < HISTORY_TTL_MS) {
    return historyCache.data;
  }

  const symbols = await marketSymbols();
  const series = await Promise.all(
    symbols.map(async (symbol) => ({
      symbol,
      candles: await fetchKlines(symbol, "1h", MAINNET_START_MS, now),
    })),
  );

  const byTime = new Map<number, VolumeBucket>();
  for (const { symbol, candles } of series) {
    const coin = coinForSymbol(symbol);
    for (const candle of candles) {
      const t = floorToInterval(Number(candle.t) || 0, "1h");
      if (!t) continue;
      const usd = candleUsd(candle);
      if (!(usd > 0)) continue;
      const row =
        byTime.get(t) ??
        ({ t, btc: 0, eth: 0, sol: 0, others: 0, total: 0, cumulative: 0 } satisfies VolumeBucket);
      row[coin] += usd;
      byTime.set(t, row);
    }
  }

  const buckets = [...byTime.values()].sort((a, b) => a.t - b.t);
  let running = 0;
  for (const row of buckets) {
    row.total = row.btc + row.eth + row.sol + row.others;
    running += row.total;
    row.cumulative = running;
  }

  const data: VolumeHistoryPayload = { range: "ALL", interval: "1h", buckets };
  historyCache = { key: "ALL:1h", at: now, data };
  return data;
}
