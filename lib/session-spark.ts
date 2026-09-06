"use client";

import { useEffect, useState } from "react";
import type { SparkRow } from "@/components/overview/MiniSpark";
import { mergeLevelPoints, type LevelPoint } from "@/lib/exchange-level-history";

function readStored(key: string): LevelPoint[] {
  const out: LevelPoint[] = [];
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SparkRow[];
      if (Array.isArray(parsed)) out.push(...parsed);
    } catch {
      // ignore a broken store
    }
  }
  return out;
}

/**
 * 24h spark of a live level (OI, active traders). One vertex per UTC hour,
 * same step as the volume 24h spark. The current hour updates in place.
 */
export function useLevelSpark(
  key: string,
  live: number,
  server: SparkRow[] = [],
): SparkRow[] {
  const [rows, setRows] = useState<SparkRow[]>([]);

  useEffect(() => {
    if (!Number.isFinite(live)) return;
    const next = mergeLevelPoints(
      server,
      readStored(key),
      live > 0 ? [{ t: Date.now(), value: live }] : [],
    );
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // quota — keep the in-memory trail only
    }
    setRows(next);
  }, [key, live, server]);

  return rows;
}

/** @deprecated use useLevelSpark */
export function useSessionSpark(key: string, value: number): SparkRow[] {
  return useLevelSpark(key, value);
}
