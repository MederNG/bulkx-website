/**
 * Snapshot live OI, active traders, and unique submissions into
 * data/exchange-levels.json. Hourly cron builds the 24h KPI sparks and
 * the unique-trade 24h delta — Bulk has no history API for these.
 *
 *   npm run record:levels
 */
import {
  mergeCounterPoints,
  mergeLevelPoints,
} from "../lib/exchange-level-history";
import {
  readExchangeLevelsFile,
  writeExchangeLevelsFile,
} from "../lib/exchange-level-store";

const EXCHANGE_API_BASE =
  process.env.BULK_EXCHANGE_API_BASE?.replace(/\/$/, "") ||
  "https://mainnet-api1.bulk.trade/api/v1";
const OI_SIDES = 2;

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${EXCHANGE_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "AURA-Intelligence/1.0" },
  });
  if (!res.ok) {
    throw new Error(`${path} ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function main() {
  const [stats, metrics] = await Promise.all([
    fetchJson<{ openInterest?: { totalUsd?: number } }>("/stats?period=1d"),
    fetchJson<{
      unique_submissions?: number;
      executor_cardinality?: { primary?: { cached_accounts?: number } };
    }>("/metrics"),
  ]);

  const now = Date.now();
  const openInterestUsd = (Number(stats.openInterest?.totalUsd) || 0) * OI_SIDES;
  const activeTraders = Number(metrics.executor_cardinality?.primary?.cached_accounts) || 0;
  const unique = Number(metrics.unique_submissions) || 0;
  if (!(openInterestUsd > 0) || !(activeTraders > 0)) {
    throw new Error(`bad snapshot oi=${openInterestUsd} traders=${activeTraders}`);
  }

  const prev = readExchangeLevelsFile();
  const next = writeExchangeLevelsFile({
    oi: mergeLevelPoints(prev.oi, [{ t: now, value: openInterestUsd }]),
    traders: mergeLevelPoints(prev.traders, [{ t: now, value: activeTraders }]),
    uniqueSubmissions: mergeCounterPoints(prev.uniqueSubmissions, [
      ...(unique > 0 ? [{ t: now, value: unique }] : []),
    ]),
  });

  console.log(
    `[levels] oi=${next.oi.length} traders=${next.traders.length} ` +
      `unique=${next.uniqueSubmissions.length} lastOi=${openInterestUsd.toFixed(0)} ` +
      `lastTraders=${activeTraders} lastUnique=${unique}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
