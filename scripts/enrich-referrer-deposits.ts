/**
 * Enrich all qualified referrers in leaderboard.json with referees_total_deposited
 * from the wallet API (offline one-shot, no full leaderboard refetch).
 */
import fs from "fs";
import path from "path";
import type { LeaderboardEntry } from "../types/index";
import { getUpstreamBase } from "../lib/upstream";

const BASE_URL = getUpstreamBase();
const WALLET_ENDPOINT = `${BASE_URL}/v1/aura/wallet`;
const LEADERBOARD_FILE = path.join(process.cwd(), "data", "leaderboard.json");

interface WalletProfile {
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
  const targets = entries.filter((e) => e.referrals_qualified > 0);

  console.log(`Enriching referred deposit totals for ${targets.length} qualified referrers...`);

  let done = 0;
  for (const entry of targets) {
    const profile = await fetchWalletProfile(entry.wallet);
    if (profile) {
      entry.referees_total_deposited = Number(profile.referees_total_deposited) || 0;
    }
    done += 1;
    if (done % 25 === 0 || done === targets.length) {
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
