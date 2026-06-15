"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * TVL totals are fetched live from the upstream API. This timer marks the top
 * of each UTC hour (when git snapshots refresh) and triggers a client refetch.
 */
function msUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function NextRefreshTimer() {
  const [ms, setMs] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => setMs(msUntilNextHour());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (ms === null) return;
    const refreshing = ms <= 0;
    if (refreshing && !firedRef.current) {
      firedRef.current = true;
      window.dispatchEvent(new Event("aura:data-refresh"));
    }
    if (!refreshing) {
      firedRef.current = false;
    }
  }, [ms]);

  if (ms === null) return null;

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const refreshing = totalSeconds <= 0;

  return (
    <span className="inline-flex items-center gap-1">
      <RefreshCw className={refreshing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
      {refreshing ? (
        <span>Refreshing data…</span>
      ) : (
        <span>
          Next data refresh in{" "}
          <span className="font-mono tabular-nums text-text-primary">
            {minutes}m {seconds.toString().padStart(2, "0")}s
          </span>
        </span>
      )}
    </span>
  );
}
