"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Data is refreshed hourly (GitHub Actions at :00 UTC, Vercel Cron backup at :15 UTC), so the
 * next refresh lands at the top of the next hour. This counts down to it live.
 */
function msUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function NextRefreshTimer() {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMs(msUntilNextHour());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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
