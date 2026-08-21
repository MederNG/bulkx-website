"use client";

import { useEffect, useState } from "react";
import { formatRemainingDuration } from "@/lib/projected-snapshot-tvl";
import { cn } from "@/lib/utils";

/**
 * Counts down to the next weekly Aura snapshot (Sat 13:00 UTC) — the only
 * real future timestamp anywhere in the campaign data. There is no final
 * airdrop date on record, so the caption says so rather than letting "drop"
 * read as that date.
 */
export function AuraDropCountdown({
  nextSnapshotTimestamp,
  showCaption = true,
  label = "Next Aura drop",
  centered = false,
}: {
  nextSnapshotTimestamp: number;
  /** The "not the final airdrop date" disclaimer — off when the line is
   * used as a compact label elsewhere (e.g. standing in for a section
   * header), where there's no room for a second line. */
  showCaption?: boolean;
  /** The timestamp itself is always the same snapshot — this changes only
   * how the line reads depending on where it's sitting. */
  label?: string;
  /** Centre the line rather than starting it at the left edge — for cards
   * whose other contents are centred too. */
  centered?: boolean;
}) {
  // Computed only after mount (not on the initial render) so the server-
  // rendered markup and the client's first paint match exactly — a "now"
  // captured during SSR would otherwise drift from the client's "now" by
  // however long the response took to arrive, and React would flag the
  // mismatch.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemainingMs(Math.max(0, nextSnapshotTimestamp - Date.now()));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [nextSnapshotTimestamp]);

  return (
    <div className="leading-none">
      <div className={cn("flex items-baseline gap-1.5", centered && "justify-center")}>
        <span className="font-sans text-[11px] text-text-muted">{label}</span>
        <span className="font-data font-semibold text-text-primary">
          {remainingMs != null ? formatRemainingDuration(remainingMs) : "—"}
        </span>
      </div>
      {showCaption && (
        <p
          className={cn(
            "m-0 mt-0.5 text-[10px] leading-snug text-text-dim",
            centered && "text-center"
          )}
        >
          Weekly points checkpoint (Sat 13:00 UTC) — not the final airdrop date.
        </p>
      )}
    </div>
  );
}
