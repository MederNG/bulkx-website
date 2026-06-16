/**
 * Lightweight refresh — pulls aggregate financials (TVL, deposited, withdrawn)
 * from the upstream leaderboard `totals` block, patches per-wallet deposit /
 * withdraw / current amounts in data/leaderboard.json, and appends a TVL snapshot.
 *
 * Aura, categories, and referrals stay on the weekly `npm run fetch` cadence.
 *
 *   npm run fetch:totals
 */
import fs from "fs";
import path from "path";
import type { LeaderboardEntry, Snapshot, Totals } from "../types/index";
import {
  fetchAllLeaderboardFinancialRows,
  mergeFinancialRowsIntoEntries,
  recomputeDepositRanks,
  type LeaderboardFinancialPage,
} from "../lib/leaderboard-financial-sync";
import { getUpstreamBase } from "../lib/upstream";

const BASE_URL = getUpstreamBase();
const ENDPOINT = `${BASE_URL}/v1/aura/predeposit/leaderboard`;

const DATA_DIR = path.join(process.cwd(), "data");
const TOTALS_FILE = path.join(DATA_DIR, "totals.json");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");

const MAX_SNAPSHOTS = 2160; // ~90 days of hourly snapshots
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const PAGE_SIZE = 2000;
const PAGE_DELAY_MS = 300;

interface ApiTotals {
  total_wallets?: number;
  total_deposited_amount?: number;
  total_withdrawn_amount?: number;
  total_current_amount?: number;
}

interface ApiResponse {
  total?: number;
  totals?: ApiTotals;
  total_pages?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

async function fetchTotals(): Promise<ApiResponse> {
  const url = `${ENDPOINT}?page=1&page_size=1`;
  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "AURA-Intelligence/1.0", Accept: "application/json" },
      });
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      const wait = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      console.warn(`[totals] network error — retry ${attempt}/${MAX_RETRIES} in ${wait}ms`);
      await sleep(wait);
      continue;
    }

    if (res.ok) return (await res.json()) as ApiResponse;

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      await sleep((retryAfter ?? backoff) + Math.floor(Math.random() * 250));
      continue;
    }

    throw new Error(`Totals fetch failed: ${res.status} ${res.statusText}`);
  }
}

function readLeaderboardAura(): { totalAura: number; wallets: number } {
  if (!fs.existsSync(LEADERBOARD_FILE)) return { totalAura: 0, wallets: 0 };
  try {
    const lb = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf-8")) as { aura?: number }[];
    return {
      totalAura: lb.reduce((s, e) => s + (Number(e.aura) || 0), 0),
      wallets: lb.length,
    };
  } catch {
    return { totalAura: 0, wallets: 0 };
  }
}

async function fetchLeaderboardPage(
  page: number,
  pageSize: number,
  noTotal: boolean
): Promise<LeaderboardFinancialPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (noTotal) params.set("no_total", "true");
  const url = `${ENDPOINT}?${params.toString()}`;

  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "AURA-Intelligence/1.0", Accept: "application/json" },
      });
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      const wait = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      console.warn(`[totals] page ${page} network error — retry ${attempt}/${MAX_RETRIES}`);
      await sleep(wait);
      continue;
    }

    if (res.ok) return (await res.json()) as LeaderboardFinancialPage;

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      await sleep((retryAfter ?? backoff) + Math.floor(Math.random() * 250));
      continue;
    }

    throw new Error(`Leaderboard page ${page} failed: ${res.status} ${res.statusText}`);
  }
}

function readLeaderboardEntries(): LeaderboardEntry[] {
  if (!fs.existsSync(LEADERBOARD_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf-8")) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

async function patchLeaderboardFinancials(): Promise<number> {
  const entries = readLeaderboardEntries();
  if (!entries.length) {
    console.log("No local leaderboard to patch — skipping per-wallet financial sync.");
    return 0;
  }

  console.log(`Syncing deposit/withdraw data for ${entries.length.toLocaleString()} wallets...`);
  const rows = await fetchAllLeaderboardFinancialRows(fetchLeaderboardPage, {
    pageSize: PAGE_SIZE,
    pageDelayMs: PAGE_DELAY_MS,
  });

  const merged = mergeFinancialRowsIntoEntries(entries, rows);
  recomputeDepositRanks(merged);
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(merged, null, 2));
  console.log(`Patched leaderboard.json (${rows.length.toLocaleString()} upstream rows).`);
  return merged.length;
}

async function main() {
  console.log(`Fetching aggregate totals from ${BASE_URL}...`);
  const res = await fetchTotals();
  const t = res.totals ?? {};

  const tvl = Number(t.total_current_amount) || 0;
  const totalDeposited = Number(t.total_deposited_amount) || 0;
  const totalWithdrawn = Number(t.total_withdrawn_amount) || 0;
  const totalWallets = Number(t.total_wallets) || 0;

  if (tvl <= 0 && totalDeposited <= 0) {
    throw new Error("Upstream returned empty totals — refusing to overwrite.");
  }

  const totals: Totals = {
    tvl,
    totalDeposited,
    totalWithdrawn,
    totalWallets,
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOTALS_FILE, JSON.stringify(totals, null, 2));

  // Append a TVL snapshot. Aura/wallet count come from the weekly leaderboard
  // so the chart's secondary series stay consistent between weekly refreshes.
  const { totalAura, wallets } = readLeaderboardAura();
  let snapshots: Snapshot[] = [];
  if (fs.existsSync(SNAPSHOTS_FILE)) {
    try {
      snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf-8")) as Snapshot[];
    } catch {
      snapshots = [];
    }
  }
  snapshots.push({
    timestamp: new Date().toISOString(),
    tvl,
    totalAura,
    wallets: wallets || res.total || totalWallets,
    totalDeposited,
    totalWithdrawn,
  });
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS), null, 2));

  await patchLeaderboardFinancials();

  console.log(`Saved totals → totals.json`);
  console.log(`   TVL:             $${tvl.toLocaleString()}`);
  console.log(`   Total Deposited: $${totalDeposited.toLocaleString()}`);
  console.log(`   Total Withdrawn: $${totalWithdrawn.toLocaleString()}`);
  console.log(`Appended snapshot (${snapshots.length} kept).`);
}

main().catch((err) => {
  console.error("Totals fetch failed:", err);
  process.exit(1);
});
