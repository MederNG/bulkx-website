"use client";

import { useCallback, useEffect, useState } from "react";
import { TvlChart } from "@/components/charts/Charts";
import type { Snapshot } from "@/types";

export function LiveTvlChart({ initial }: { initial: Snapshot[] }) {
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tvl-snapshots", { cache: "no-store" });
      if (!res.ok) return;
      const snapshots = (await res.json()) as Snapshot[];
      if (snapshots.length > 0) setData(snapshots);
    } catch {
      // Keep showing the last known series.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    const onRefresh = () => refresh();
    window.addEventListener("aura:data-refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("aura:data-refresh", onRefresh);
    };
  }, [refresh]);

  return <TvlChart data={data} />;
}
