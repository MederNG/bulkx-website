/**
 * Sample exchange fullAccount snapshots (14d volume, equity, PnL).
 * Bulk has no ranking API — we walk Aura wallets and keep anyone with
 * volume, equity, or non-zero PnL.
 *
 *   npm run record:volume
 */
import { getLeaderboard } from "../lib/fetcher";
import {
  readVolumeLeaderboardFile,
  sampleWalletVolumes,
  writeVolumeLeaderboardFile,
} from "../lib/volume-leaderboard";

const BATCH = Number.isFinite(Number(process.env.VOLUME_SCAN_BATCH))
  ? Number(process.env.VOLUME_SCAN_BATCH)
  : 400;

async function main() {
  const wallets = getLeaderboard().map((entry) => entry.wallet);
  if (!wallets.length) throw new Error("empty leaderboard");

  const prev = readVolumeLeaderboardFile();
  const known = prev.rows
    .filter((row) => row.volumeUsd > 0 || (row.pnlUsd ?? 0) !== 0)
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, 80)
    .map((row) => row.wallet);
  const topAura = wallets.slice(0, 100);

  const start = ((prev.cursor % wallets.length) + wallets.length) % wallets.length;
  const scan: string[] = [];
  for (let i = 0; i < BATCH && i < wallets.length; i += 1) {
    scan.push(wallets[(start + i) % wallets.length]);
  }

  const sampled = await sampleWalletVolumes([...new Set([...topAura, ...known, ...scan])]);
  const byWallet = new Map(prev.rows.map((row) => [row.wallet, row]));
  for (const row of sampled) byWallet.set(row.wallet, row);

  const next = writeVolumeLeaderboardFile({
    cursor: (start + scan.length) % wallets.length,
    windowDays: 14,
    rows: [...byWallet.values()],
  });

  console.log(
    `[volume] rows=${next.rows.length} scanned=${scan.length} cursor=${next.cursor}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
