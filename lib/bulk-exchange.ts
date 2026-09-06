/**
 * Mainnet exchange HTTP (not the Aura indexer).
 * https://mainnet-api1.bulk.trade/api/v1
 */
export const EXCHANGE_API_BASE =
  process.env.BULK_EXCHANGE_API_BASE?.replace(/\/$/, "") ||
  "https://mainnet-api1.bulk.trade/api/v1";

export interface ExchangeMarketStat {
  symbol: string;
  volume: number;
  quoteVolume: number;
  openInterest: number;
  lastPrice: number;
  markPrice: number;
}

export interface ExchangeStats {
  timestamp: number;
  period: string;
  volume: { totalUsd: number };
  openInterest: { totalUsd: number };
  markets: ExchangeMarketStat[];
}

export interface ExchangeMetrics {
  received_count?: number;
  unique_submissions?: number;
  http_received_count?: number;
  timestamp_unix_ms?: number;
  executor_cardinality?: {
    primary?: {
      cached_accounts?: number;
      world_accounts?: number;
    };
  };
}

export interface ExchangeCandle {
  t: number;
  T: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
}

async function exchangeFetch(
  path: string,
  options: { revalidate?: number; noStore?: boolean } = {},
): Promise<Response> {
  const { revalidate = 15, noStore = false } = options;
  const url = `${EXCHANGE_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "AURA-Intelligence/1.0" },
    ...(noStore ? { cache: "no-store" as const } : { next: { revalidate } }),
  });
}

/** Markets + OI only. Do not use `volume` / `quoteVolume` — those fields
 * (and `/ticker` 24h volume / change) are currently wrong. Volume comes
 * from `fetchKlines`. */
export async function fetchExchangeStats(): Promise<ExchangeStats | null> {
  const res = await exchangeFetch("/stats?period=1d", { revalidate: 15 });
  if (!res.ok) return null;
  return (await res.json()) as ExchangeStats;
}

export async function fetchExchangeMetrics(noStore = false): Promise<ExchangeMetrics | null> {
  const res = await exchangeFetch("/metrics", noStore ? { noStore: true } : { revalidate: 5 });
  if (!res.ok) return null;
  return (await res.json()) as ExchangeMetrics;
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  startTime?: number,
  endTime?: number,
): Promise<ExchangeCandle[]> {
  const params = new URLSearchParams({ symbol, interval });
  if (startTime != null) params.set("startTime", String(startTime));
  if (endTime != null) params.set("endTime", String(endTime));
  const res = await exchangeFetch(`/klines?${params.toString()}`, { revalidate: 60 });
  if (!res.ok) return [];
  const data = (await res.json()) as ExchangeCandle[];
  return Array.isArray(data) ? data : [];
}

export function marketBase(symbol: string): string {
  return symbol.replace(/-USD$/i, "").toUpperCase();
}
