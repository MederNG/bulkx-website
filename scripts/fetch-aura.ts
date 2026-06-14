/**
 * Offline fetch — pulls the full Aura leaderboard from the official BULK
 * indexer API and writes it to local snapshot files.
 *
 * This is a MANUAL command, not a runtime dependency. The Next.js app never
 * calls the API; it only ever reads data/leaderboard.json + data/snapshots.json.
 * Run this whenever you want to refresh the local data with live numbers:
 *
 *   npm run fetch
 *   npm run fetch -- --page-size=2000 --max-pages=50
 *
 * Source: https://indexer.bulk.trade/v1/aura/predeposit/leaderboard
 */
import fs from "fs";
import path from "path";
import type { LeaderboardEntry, Snapshot } from "../types/index";
import { getUpstreamBase } from "../lib/upstream";

const BASE_URL = getUpstreamBase();
const LEADERBOARD_ENDPOINT = `${BASE_URL}/v1/aura/predeposit/leaderboard`;
const WALLET_ENDPOINT = `${BASE_URL}/v1/aura/wallet`;

const DATA_DIR = path.join(process.cwd(), "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");

const PAGE_DELAY_MS = 300;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

interface ApiRow {
  rank?: number;
  wallet: string;
  referral_number?: number;
  deposited_amount?: number;
  withdrawn_amount?: number;
  current_amount?: number;
  total_held_time_seconds?: number;
  total_held_time_hours?: number;
  aura?: number;
  categories?: Record<string, number>;
  updated_at?: string;
}

interface ApiResponse {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  totals?: {
    total_wallets?: number;
    total_deposited_amount?: number;
    total_withdrawn_amount?: number;
    total_current_amount?: number;
  };
  rows: ApiRow[];
}

interface WalletProfile {
  referrals_sent?: number;
  referrals_qualified?: number;
  referrals_rewarded?: number;
  referees_total_deposited?: number;
}

interface Options {
  pageSize: number;
  maxPages: number;
  enrichReferrals: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let pageSize = 2000;
  let maxPages = Infinity;
  let enrichReferrals = true;

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "page-size") pageSize = Math.min(2000, Math.max(1, Number(value) || 2000));
    if (key === "max-pages") maxPages = Math.max(1, Number(value) || Infinity);
    if (key === "no-enrich") enrichReferrals = false;
  }

  return { pageSize, maxPages, enrichReferrals };
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

async function fetchPage(page: number, pageSize: number, noTotal: boolean): Promise<ApiResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (noTotal) params.set("no_total", "true");
  const url = `${LEADERBOARD_ENDPOINT}?${params.toString()}`;

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
      console.warn(`[fetch] network error on page ${page} — retry ${attempt}/${MAX_RETRIES} in ${wait}ms`);
      await sleep(wait);
      continue;
    }

    if (res.ok) {
      return (await res.json()) as ApiResponse;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      const wait = (retryAfter ?? backoff) + Math.floor(Math.random() * 250);
      attempt += 1;
      console.warn(
        `[fetch] ${res.status} on page ${page} — retry ${attempt}/${MAX_RETRIES} in ${wait}ms` +
          (retryAfter != null ? " (Retry-After honored)" : "")
      );
      await sleep(wait);
      continue;
    }

    throw new Error(`Leaderboard fetch failed on page ${page}: ${res.status} ${res.statusText}`);
  }
}

async function fetchWalletProfile(wallet: string): Promise<WalletProfile | null> {
  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      res = await fetch(`${WALLET_ENDPOINT}/${wallet}`, {
        headers: { "User-Agent": "AURA-Intelligence/1.0", Accept: "application/json" },
      });
    } catch {
      if (attempt >= 3) return null;
      await sleep(Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS));
      attempt += 1;
      continue;
    }

    if (res.ok) return (await res.json()) as WalletProfile;
    if (res.status === 404) return null;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      await sleep((retryAfter ?? backoff) + Math.floor(Math.random() * 200));
      attempt += 1;
      continue;
    }
    return null;
  }
}

async function enrichAllReferrerProfiles(entries: LeaderboardEntry[]): Promise<void> {
  const targets = entries.filter((e) => (e.referral_number ?? 0) > 0);

  if (targets.length === 0) return;

  console.log(`Enriching referral profiles for ${targets.length} wallets (referral_number > 0)...`);

  let done = 0;
  for (const entry of targets) {
    const profile = await fetchWalletProfile(entry.wallet);
    if (profile) {
      entry.referrals_sent = Number(profile.referrals_sent) || 0;
      entry.referrals_qualified = Number(profile.referrals_qualified) || 0;
      entry.referrals_rewarded = Number(profile.referrals_rewarded) || 0;
      entry.referees_total_deposited = Number(profile.referees_total_deposited) || 0;
    }
    done += 1;
    if (done % 50 === 0 || done === targets.length) {
      console.log(`  enriched ${done}/${targets.length} referrers`);
    }
    await sleep(80);
  }
}

function normalizeRow(row: ApiRow): LeaderboardEntry {
  const categories: Record<string, number> = {};
  for (const [key, val] of Object.entries(row.categories ?? {})) {
    categories[key] = Number(val) || 0;
  }

  return {
    wallet: row.wallet,
    aura: Number(row.aura) || 0,
    aura_rank: Number(row.rank) || 0,
    deposit_rank: 0,
    deposited_amount: Number(row.deposited_amount) || 0,
    withdrawn_amount: Number(row.withdrawn_amount) || 0,
    current_amount: Number(row.current_amount) || 0,
    referrals_sent: 0,
    referrals_qualified: 0,
    referrals_rewarded: 0,
    categories,
    total_held_time_seconds: Number(row.total_held_time_seconds) || 0,
    total_held_time_hours: Number(row.total_held_time_hours) || 0,
    referral_number: Number(row.referral_number) || 0,
    updated_at: row.updated_at,
  };
}

function appendSnapshot(entries: LeaderboardEntry[]): void {
  const tvl = entries.reduce((s, e) => s + e.current_amount, 0);
  const totalAura = entries.reduce((s, e) => s + e.aura, 0);

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
    wallets: entries.length,
  });

  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));
}

async function main() {
  const { pageSize, maxPages, enrichReferrals } = parseArgs();
  console.log(`Fetching Aura leaderboard from ${BASE_URL} (page_size=${pageSize})...`);

  const first = await fetchPage(1, pageSize, false);
  const totalPages = Math.min(first.total_pages || 1, maxPages);
  const rows: ApiRow[] = [...first.rows];

  console.log(`Total wallets: ${first.total?.toLocaleString() ?? "?"} across ${first.total_pages} pages`);
  if (maxPages !== Infinity) console.log(`Limiting to ${maxPages} pages (--max-pages).`);

  for (let page = 2; page <= totalPages; page++) {
    await sleep(PAGE_DELAY_MS);
    const data = await fetchPage(page, pageSize, true);
    rows.push(...data.rows);
    if (page % 10 === 0 || page === totalPages) {
      console.log(`  fetched page ${page}/${totalPages} (${rows.length.toLocaleString()} rows)`);
    }
    if (!data.has_next) break;
  }

  const entries = rows
    .map(normalizeRow)
    .filter((e) => e.wallet && e.wallet.length > 0);

  entries.sort((a, b) => b.aura - a.aura);
  entries.forEach((e, i) => {
    e.aura_rank = i + 1;
  });

  const byDeposit = [...entries].sort((a, b) => b.current_amount - a.current_amount);
  byDeposit.forEach((e, i) => {
    e.deposit_rank = i + 1;
  });

  if (enrichReferrals) {
    await enrichAllReferrerProfiles(entries);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(LEADERBOARD_FILE)) {
    fs.copyFileSync(LEADERBOARD_FILE, path.join(DATA_DIR, "leaderboard.backup.json"));
    console.log("Backed up previous leaderboard → leaderboard.backup.json");
  }

  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2));
  appendSnapshot(entries);

  const tvl = entries.reduce((s, e) => s + e.current_amount, 0);
  const totalAura = entries.reduce((s, e) => s + e.aura, 0);
  console.log(`Saved ${entries.length.toLocaleString()} wallets to leaderboard.json`);
  console.log(`   TVL:        $${tvl.toLocaleString()}`);
  console.log(`   Total Aura: ${totalAura.toLocaleString()}`);
  console.log("Appended snapshot. The app will serve this local data — no runtime API calls.");
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
