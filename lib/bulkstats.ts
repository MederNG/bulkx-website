/**
 * Community indexer at api.bulkstats.com.
 * Official Bulk HTTP has no unique-fill count (candle `n` is orders/ticks,
 * `unique_submissions` is every signed tx). BulkStats counts fills from
 * the public trades stream — same Total Trades as their General card.
 */
export const BULKSTATS_API_BASE =
  process.env.BULKSTATS_API_BASE?.replace(/\/$/, "") || "https://api.bulkstats.com";

export interface BulkstatsTradeStats {
  trades: number;
  uniqueTraders: number;
}

export async function fetchBulkstatsTradeStats(): Promise<BulkstatsTradeStats | null> {
  const res = await fetch(`${BULKSTATS_API_BASE}/api/analytics/stats`, {
    headers: { Accept: "application/json", "User-Agent": "AURA-Intelligence/1.0" },
    next: { revalidate: 15 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    trades?: { count?: number };
    uniqueTraders?: number;
  };
  const trades = Number(data.trades?.count) || 0;
  if (!(trades > 0)) return null;
  return {
    trades,
    uniqueTraders: Number(data.uniqueTraders) || 0,
  };
}
