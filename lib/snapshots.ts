import fs from "fs";
import path from "path";
import type { Snapshot } from "@/types";

const SNAPSHOTS_FILE = path.join(process.cwd(), "data", "snapshots.json");

export function readSnapshots(): Snapshot[] {
  if (!fs.existsSync(SNAPSHOTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf-8")) as Snapshot[];
}

export function writeSnapshots(snapshots: Snapshot[]): void {
  const dir = path.dirname(SNAPSHOTS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));
}

export function appendSnapshot(snapshot: Omit<Snapshot, "timestamp">): Snapshot[] {
  const snapshots = readSnapshots();
  const entry: Snapshot = {
    ...snapshot,
    timestamp: new Date().toISOString(),
  };
  snapshots.push(entry);
  writeSnapshots(snapshots);
  return snapshots;
}

export function filterSnapshotsByRange(
  snapshots: Snapshot[],
  range: "24H" | "7D" | "30D" | "ALL"
): Snapshot[] {
  if (range === "ALL" || snapshots.length === 0) return snapshots;

  const now = Date.now();
  const ms =
    range === "24H"
      ? 24 * 60 * 60 * 1000
      : range === "7D"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  return snapshots.filter((s) => now - new Date(s.timestamp).getTime() <= ms);
}
