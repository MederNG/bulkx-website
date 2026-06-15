import { getLiveTotals } from "@/lib/live-totals";
import { readSnapshots } from "@/lib/snapshots";
import type { Snapshot } from "@/types";

const MERGE_GAP_MS = 5 * 60 * 1000;

/** Historical snapshots with the latest TVL point synced from the live API. */
export async function getLiveSnapshots(): Promise<Snapshot[]> {
  const snapshots = [...readSnapshots()];
  const totals = await getLiveTotals();
  if (!totals?.tvl) return snapshots;

  const livePoint: Snapshot = {
    timestamp: totals.updatedAt,
    tvl: totals.tvl,
    totalAura: snapshots.at(-1)?.totalAura ?? 0,
    wallets: totals.totalWallets,
  };

  if (snapshots.length === 0) return [livePoint];

  const last = snapshots[snapshots.length - 1]!;
  const gap = new Date(livePoint.timestamp).getTime() - new Date(last.timestamp).getTime();

  if (gap < MERGE_GAP_MS) {
    snapshots[snapshots.length - 1] = {
      ...last,
      tvl: livePoint.tvl,
      timestamp: livePoint.timestamp,
      wallets: livePoint.wallets,
    };
  } else {
    snapshots.push(livePoint);
  }

  return snapshots;
}
