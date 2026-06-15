import fs from "fs";
import path from "path";
import type { Totals } from "@/types";

const TOTALS_FILE = path.join(process.cwd(), "data", "totals.json");

// Daily-refreshed aggregate financials (TVL / deposited / withdrawn). Cached by
// file mtime so repeated reads within a process don't re-parse the file.
let cache: { mtimeMs: number; data: Totals | null } | null = null;

export function readTotals(): Totals | null {
  if (!fs.existsSync(TOTALS_FILE)) return null;
  const mtimeMs = fs.statSync(TOTALS_FILE).mtimeMs;
  if (cache && cache.mtimeMs === mtimeMs) return cache.data;
  try {
    const data = JSON.parse(fs.readFileSync(TOTALS_FILE, "utf-8")) as Totals;
    cache = { mtimeMs, data };
    return data;
  } catch {
    return null;
  }
}
