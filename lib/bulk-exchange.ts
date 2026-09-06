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

export interface AccountFeeTier {
  rollingVolume: number;
  windowDays: number;
}

export interface AccountSnapshot {
  volumeUsd: number;
  windowDays: number;
  balanceUsd: number;
  pnlUsd: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function unwrapAccount(payload: unknown): Record<string, unknown> | null {
  const first = Array.isArray(payload) ? payload[0] : payload;
  const root = asRecord(first);
  if (!root) return null;
  return asRecord(root.fullAccount) ?? asRecord(root.feeTier) ?? root;
}

function readFeeTier(payload: unknown): AccountFeeTier | null {
  const quote = unwrapAccount(payload);
  if (!quote) return null;
  const rollingVolume = Number(quote.rollingVolume);
  if (!Number.isFinite(rollingVolume) || rollingVolume < 0) return null;
  return {
    rollingVolume,
    windowDays: Number(quote.windowDays) || 14,
  };
}

function readAccountSnapshot(payload: unknown): AccountSnapshot | null {
  const account = unwrapAccount(payload);
  if (!account) return null;
  const margin = asRecord(account.margin) ?? {};
  const feeTiers = Array.isArray(account.feeTiers) ? account.feeTiers : [];
  const global =
    feeTiers
      .map((row) => asRecord(row))
      .find((row) => row && (row.symbol === "global" || row.symbol == null)) ??
    asRecord(feeTiers[0]);
  const volumeUsd = Number(global?.rollingVolume);
  const balanceUsd = Number(margin.totalMargin ?? margin.totalBalance);
  const realized = Number(margin.realizedPnl) || 0;
  const unrealized = Number(margin.unrealizedPnl) || 0;
  if (![volumeUsd, balanceUsd].some((n) => Number.isFinite(n))) return null;
  return {
    volumeUsd: Number.isFinite(volumeUsd) && volumeUsd > 0 ? volumeUsd : 0,
    windowDays: Number(global?.windowDays) || 14,
    balanceUsd: Number.isFinite(balanceUsd) ? balanceUsd : 0,
    pnlUsd: realized + unrealized,
  };
}

async function postAccount(wallet: string, type: "feeTier" | "fullAccount"): Promise<unknown> {
  const res = await fetch(`${EXCHANGE_API_BASE}/account`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "AURA-Intelligence/1.0",
    },
    body: JSON.stringify({ type, user: wallet }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/** Unsigned account fee-tier quote — 14d rolling volume for the Volume board. */
export async function fetchAccountFeeTier(wallet: string): Promise<AccountFeeTier | null> {
  return readFeeTier(await postAccount(wallet, "feeTier"));
}

/** Margin, PnL, and 14d volume from an unsigned fullAccount snapshot. */
export async function fetchAccountSnapshot(wallet: string): Promise<AccountSnapshot | null> {
  return readAccountSnapshot(await postAccount(wallet, "fullAccount"));
}
