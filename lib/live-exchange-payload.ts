import { fetchExchangeMetrics, fetchExchangeStats } from "@/lib/bulk-exchange";
import { getExchangeLevelHistory, recordExchangeLevels } from "@/lib/exchange-level-store";
import { sumCandleVolumes } from "@/lib/volume-history";
import type { LevelPoint } from "@/lib/exchange-level-history";

export const LIVE_EXCHANGE_TTL_MS = 15_000;
/** Official `/stats` OI is one-sided; display longs + shorts. */
const OI_SIDES = 2;

export interface LiveExchangePayload {
  volume24hUsd: number;
  volumeTotalUsd: number;
  trades24h: number;
  openInterestUsd: number;
  activeTraders: number;
  totalAccounts: number;
  tps: number | null;
  oiHistory: LevelPoint[];
  tradersHistory: LevelPoint[];
  updatedAt: string;
}

const EMPTY: LiveExchangePayload = {
  volume24hUsd: 0,
  volumeTotalUsd: 0,
  trades24h: 0,
  openInterestUsd: 0,
  activeTraders: 0,
  totalAccounts: 0,
  tps: null,
  oiHistory: [],
  tradersHistory: [],
  updatedAt: new Date(0).toISOString(),
};

let payloadCache: { at: number; data: LiveExchangePayload } | null = null;
let lastTxSample: { at: number; unique: number } | null = null;

function tpsFromSample(unique: number, at: number): number | null {
  const prev = lastTxSample;
  lastTxSample = { at, unique };
  if (!prev || unique < prev.unique) return null;
  const dt = (at - prev.at) / 1000;
  if (dt < 0.4) return null;
  return (unique - prev.unique) / dt;
}

export async function buildLiveExchangePayload(): Promise<LiveExchangePayload> {
  const now = Date.now();
  if (payloadCache && now - payloadCache.at < LIVE_EXCHANGE_TTL_MS) {
    return payloadCache.data;
  }

  try {
    const [stats, metrics, candleVolume] = await Promise.all([
      fetchExchangeStats(),
      fetchExchangeMetrics(true),
      sumCandleVolumes(),
    ]);
    const unique = Number(metrics?.unique_submissions) || 0;
    const sampled = unique > 0 ? tpsFromSample(unique, Date.now()) : null;
    const tps = sampled ?? payloadCache?.data.tps ?? null;
    const data: LiveExchangePayload = {
      // Volume from klines only. `/stats`, `/ticker`, and ticker WS fields
      // currently under-report 24h volume / change.
      volume24hUsd: candleVolume.volume24hUsd,
      volumeTotalUsd: candleVolume.volumeTotalUsd || candleVolume.volume24hUsd,
      trades24h: candleVolume.trades24h,
      openInterestUsd: (Number(stats?.openInterest.totalUsd) || 0) * OI_SIDES,
      activeTraders: Number(metrics?.executor_cardinality?.primary?.cached_accounts) || 0,
      totalAccounts: Number(metrics?.executor_cardinality?.primary?.world_accounts) || 0,
      tps,
      oiHistory: [],
      tradersHistory: [],
      updatedAt: new Date(now).toISOString(),
    };
    recordExchangeLevels(data.openInterestUsd, data.activeTraders);
    const history = getExchangeLevelHistory();
    data.oiHistory = history.oi;
    data.tradersHistory = history.traders;
    payloadCache = { at: now, data };
    return data;
  } catch {
    return payloadCache?.data ?? EMPTY;
  }
}

export const LIVE_EXCHANGE_SEED: LiveExchangePayload = {
  ...EMPTY,
  updatedAt: new Date().toISOString(),
};
