/**
 * Offline fetch — pulls the full Aura leaderboard from the official BULK
 * indexer API and writes it to local snapshot files.
 *
 * Fast path (default): parallel pages, no per-wallet referral enrichment (~1–2 min).
 * Full referral enrichment: npm run fetch -- --enrich (~15 min).
 *
 *   npm run fetch
 *   npm run fetch -- --enrich --page-size=2000
 *
 * Source: https://indexer.bulk.trade/v1/aura/predeposit/leaderboard
 */
import fs from "fs";
import path from "path";
import type { Snapshot } from "../types/index";
import {
  fetchAllLeaderboardPages,
  finalizeLeaderboardEntries,
  mergeReferralFieldsFromDisk,
  normalizeUpstreamRow,
  type LeaderboardUpstreamPage,
} from "../lib/leaderboard-upstream";
import { getUpstreamBase } from "../lib/upstream";

const BASE_URL = getUpstreamBase();
const LEADERBOARD_ENDPOINT = `${BASE_URL}/v1/aura/predeposit/leaderboard`;
const WALLET_ENDPOINT = `${BASE_URL}/v1/aura/wallet`;

const DATA_DIR = path.join(process.cwd(), "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");

const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;
const ENRICH_CONCURRENCY = 12;

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
  writeSnapshot: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let pageSize = 2000;
  let maxPages = Infinity;
  let enrichReferrals = false;
  let writeSnapshot = true;

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "page-size") pageSize = Math.min(2000, Math.max(1, Number(value) || 2000));
    if (key === "max-pages") maxPages = Math.max(1, Number(value) || Infinity);
    if (key === "enrich") enrichReferrals = true;
    if (key === "no-snapshot") writeSnapshot = false;
  }

  return { pageSize, maxPages, enrichReferrals, writeSnapshot };
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

async function fetchPage(page: number, pageSize: number, noTotal: boolean): Promise<LeaderboardUpstreamPage> {
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
      return (await res.json()) as LeaderboardUpstreamPage;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      const wait = (retryAfter ?? backoff) + Math.floor(Math.random() * 250);
      attempt += 1;
      console.warn(
        `[fetch] ${res.status} on page ${page} — retry ${attempt}/${MAX_RETRIES} in ${wait}ms` +
          (retryAfter != null ? " (Retry-After honored)" : ""),
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

async function enrichReferrerProfiles(
  entries: ReturnType<typeof normalizeUpstreamRow>[],
): Promise<void> {
  const targets = entries.filter(
    (entry): entry is NonNullable<typeof entry> =>
      entry !== null && (entry.referral_number ?? 0) > 0,
  );

  if (targets.length === 0) return;

  console.log(`Enriching referral profiles for ${targets.length} wallets (parallel)...`);

  let done = 0;
  for (let offset = 0; offset < targets.length; offset += ENRICH_CONCURRENCY) {
    const batch = targets.slice(offset, offset + ENRICH_CONCURRENCY);
    await Promise.all(
      batch.map(async (entry) => {
        const profile = await fetchWalletProfile(entry.wallet);
        if (profile) {
          entry.referrals_sent = Number(profile.referrals_sent) || 0;
          entry.referrals_qualified = Number(profile.referrals_qualified) || 0;
          entry.referrals_rewarded = Number(profile.referrals_rewarded) || 0;
          entry.referees_total_deposited = Number(profile.referees_total_deposited) || 0;
        }
        done += 1;
      }),
    );
    if (done % 100 === 0 || done === targets.length) {
      console.log(`  enriched ${done}/${targets.length} referrers`);
    }
  }
}

function appendSnapshot(entries: NonNullable<ReturnType<typeof normalizeUpstreamRow>>[]): void {
  const tvl = entries.reduce((sum, entry) => sum + entry.current_amount, 0);
  const totalAura = entries.reduce((sum, entry) => sum + entry.aura, 0);

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

  const MAX_SNAPSHOTS = 2160;
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS), null, 2));
}

async function main() {
  const { pageSize, maxPages, enrichReferrals, writeSnapshot } = parseArgs();
  console.log(
    `Fetching Aura leaderboard from ${BASE_URL} (page_size=${pageSize}, parallel=6` +
      `${enrichReferrals ? ", enrich=on" : ""})...`,
  );

  const rows = await fetchAllLeaderboardPages(fetchPage, {
    pageSize,
    maxPages,
    concurrency: 6,
    onProgress: (page, totalPages, rowCount) => {
      if (page % 5 === 0 || page === totalPages) {
        console.log(`  fetched page ${page}/${totalPages} (${rowCount.toLocaleString()} rows)`);
      }
    },
  });

  const entries = rows
    .map(normalizeUpstreamRow)
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  finalizeLeaderboardEntries(entries);

  let diskEntries: NonNullable<ReturnType<typeof normalizeUpstreamRow>>[] = [];
  if (fs.existsSync(LEADERBOARD_FILE)) {
    try {
      diskEntries = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf-8"));
    } catch {
      diskEntries = [];
    }
  }
  const merged = mergeReferralFieldsFromDisk(entries, diskEntries);

  if (enrichReferrals) {
    await enrichReferrerProfiles(merged);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(LEADERBOARD_FILE)) {
    fs.copyFileSync(LEADERBOARD_FILE, path.join(DATA_DIR, "leaderboard.backup.json"));
    console.log("Backed up previous leaderboard → leaderboard.backup.json");
  }

  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(merged, null, 2));
  if (writeSnapshot) {
    appendSnapshot(merged);
  } else {
    console.log("Skipping snapshot append (--no-snapshot).");
  }

  const tvl = merged.reduce((sum, entry) => sum + entry.current_amount, 0);
  const totalAura = merged.reduce((sum, entry) => sum + entry.aura, 0);
  console.log(`Saved ${merged.length.toLocaleString()} wallets to leaderboard.json`);
  console.log(`   TVL:        $${tvl.toLocaleString()}`);
  console.log(`   Total Aura: ${totalAura.toLocaleString()}`);
  if (writeSnapshot) console.log("Appended snapshot.");
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
