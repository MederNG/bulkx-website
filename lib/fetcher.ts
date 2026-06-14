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
}

export function getLeaderboard(): LeaderboardEntry[] {
  return readLeaderboardFromDisk();
}
