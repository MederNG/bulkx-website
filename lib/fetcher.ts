import fs from "fs";
import path from "path";
import type { LeaderboardEntry } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");

export function getLeaderboardPath(): string {
  return LEADERBOARD_FILE;
}

export function readLeaderboardFromDisk(): LeaderboardEntry[] {
  if (!fs.existsSync(LEADERBOARD_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(LEADERBOARD_FILE, "utf-8");
  const parsed = JSON.parse(raw) as LeaderboardEntry[] | { items: LeaderboardEntry[] };
  return Array.isArray(parsed) ? parsed : parsed.items ?? [];
}

export function writeLeaderboardToDisk(entries: LeaderboardEntry[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2));
  cache = null;
}

// The leaderboard file is large (~52k entries) and immutable within a running
// process (it only changes on redeploy). Cache the parsed result and invalidate
// it when the file's mtime changes, so repeated calls don't re-parse it.
let cache: { mtimeMs: number; data: LeaderboardEntry[] } | null = null;

export function getLeaderboard(): LeaderboardEntry[] {
  if (!fs.existsSync(LEADERBOARD_FILE)) return [];
  const mtimeMs = fs.statSync(LEADERBOARD_FILE).mtimeMs;
  if (cache && cache.mtimeMs === mtimeMs) return cache.data;
  const data = readLeaderboardFromDisk();
  cache = { mtimeMs, data };
  return data;
}
