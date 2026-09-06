import fs from "fs";
import path from "path";
import {
  mergeCounterPoints,
  mergeLevelPoints,
  type LevelPoint,
} from "@/lib/exchange-level-history";

const LEVELS_FILE = path.join(process.cwd(), "data", "exchange-levels.json");

export type ExchangeLevelsFile = {
  updatedAt: string;
  oi: LevelPoint[];
  traders: LevelPoint[];
  uniqueSubmissions: LevelPoint[];
};

let oi: LevelPoint[] = [];
let traders: LevelPoint[] = [];
let uniqueSubmissions: LevelPoint[] = [];
let seeded = false;

export function readExchangeLevelsFile(): ExchangeLevelsFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(LEVELS_FILE, "utf-8")) as Partial<ExchangeLevelsFile>;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      oi: Array.isArray(parsed.oi) ? parsed.oi : [],
      traders: Array.isArray(parsed.traders) ? parsed.traders : [],
      uniqueSubmissions: Array.isArray(parsed.uniqueSubmissions) ? parsed.uniqueSubmissions : [],
    };
  } catch {
    return { updatedAt: new Date(0).toISOString(), oi: [], traders: [], uniqueSubmissions: [] };
  }
}

export function writeExchangeLevelsFile(next: Omit<ExchangeLevelsFile, "updatedAt">): ExchangeLevelsFile {
  const payload: ExchangeLevelsFile = {
    updatedAt: new Date().toISOString(),
    oi: mergeLevelPoints(next.oi),
    traders: mergeLevelPoints(next.traders),
    uniqueSubmissions: mergeCounterPoints(next.uniqueSubmissions),
  };
  fs.mkdirSync(path.dirname(LEVELS_FILE), { recursive: true });
  fs.writeFileSync(LEVELS_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function seedFromFile() {
  if (seeded) return;
  seeded = true;
  const file = readExchangeLevelsFile();
  oi = file.oi;
  traders = file.traders;
  uniqueSubmissions = file.uniqueSubmissions;
}

export function recordExchangeLevels(
  openInterestUsd: number,
  activeTraders: number,
  unique = 0,
): void {
  seedFromFile();
  const now = Date.now();
  if (openInterestUsd > 0) oi = mergeLevelPoints(oi, [{ t: now, value: openInterestUsd }]);
  if (activeTraders > 0) traders = mergeLevelPoints(traders, [{ t: now, value: activeTraders }]);
  if (unique > 0) uniqueSubmissions = mergeCounterPoints(uniqueSubmissions, [{ t: now, value: unique }]);
}

export function getExchangeLevelHistory(): {
  oi: LevelPoint[];
  traders: LevelPoint[];
  uniqueSubmissions: LevelPoint[];
} {
  seedFromFile();
  return { oi, traders, uniqueSubmissions };
}
