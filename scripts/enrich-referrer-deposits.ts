/**
 * Enrich all wallets with referral_number > 0 in leaderboard.json
 * using the wallet API (offline one-shot, no full leaderboard refetch).
 */
import fs from "fs";
import path from "path";
import type { LeaderboardEntry } from "../types/index";
import { getUpstreamBase } from "../lib/upstream";

const BASE_URL = getUpstreamBase();
const WALLET_ENDPOINT = `${BASE_URL}/v1/aura/wallet`;
const LEADERBOARD_FILE = path.join(process.cwd(), "data", "leaderboard.json");

interface WalletProfile {
  referrals_sent?: number;
  referrals_qualified?: number;
  referrals_rewarded?: number;
  referees_total_deposited?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWalletProfile(wallet: string): Promise<WalletProfile | null> {
  const res = await fetch(`${WALLET_ENDPOINT}/${wallet}`, {
    headers: { "User-Agent": "AURA-Intelligence/1.0", Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as WalletProfile;
}

async function main() {
  const entries = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf-8")) as LeaderboardEntry[];
  const targets = entries.filter((e) => (e.referral_number ?? 0) > 0);

  console.log(`Enriching referral profiles for ${targets.length} wallets...`);

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
      console.log(`  enriched ${done}/${targets.length}`);
    }
    await sleep(80);
  }

  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2));
  console.log("Updated leaderboard.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
