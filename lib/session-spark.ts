"use client";

import { useEffect, useState } from "react";
import type { SparkRow } from "@/components/overview/MiniSpark";
import { mergeLevelPoints, type LevelPoint } from "@/lib/exchange-level-history";

/** Stable identity for the default `server` arg. A `= []` default allocates a
 *  fresh array per render, and `server` is an effect dependency — that spins
 *  the effect → setRows → render loop forever. */
const NO_SERVER_ROWS: SparkRow[] = [];

function readStored(key: string): LevelPoint[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SparkRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Unavailable or broken store — the server rows still carry the trail.
    return [];
  }
}

function sameSeries(a: SparkRow[], b: SparkRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => row.t === b[i].t && row.value === b[i].value);
}

/**
 * 24h spark of a live level (OI, active traders). One vertex per UTC hour,
 * same step as the volume 24h spark. The current hour updates in place.
 */
export function useLevelSpark(
  key: string,
  live: number,
  server: SparkRow[] = NO_SERVER_ROWS,
): SparkRow[] {
  const [rows, setRows] = useState<SparkRow[]>(NO_SERVER_ROWS);

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
    // The poll re-runs this every tick; only re-render when a vertex moved.
    setRows((prev) => (sameSeries(prev, next) ? prev : next));
  }, [key, live, server]);

  return rows;
}
