export interface CategoryBreakdownItem {
  key: string;
  category: string;
  points: number;
  share: number;
}

export type AuraCategoryGroup = "retro" | "week" | "other";

export interface ParsedAuraCategory {
  group: AuraCategoryGroup;
  week?: number;
}

const REFERRAL_WEEK_RE = /^referral_week(\d+)$/;
const WEEK_PROTOCOL_RE = /^week(\d+)_protocol_.+$/;
const WEEK_RE = /^week(\d+)$/;

/** Map raw upstream category keys to Retro / Week N / Other buckets. */
export function parseAuraCategoryKey(key: string): ParsedAuraCategory {
  if (key.startsWith("retro_")) {
    return { group: "retro" };
  }

  const referralMatch = key.match(REFERRAL_WEEK_RE);
  if (referralMatch) {
    return { group: "week", week: Number(referralMatch[1]) };
  }

  const protocolMatch = key.match(WEEK_PROTOCOL_RE);
  if (protocolMatch) {
    return { group: "week", week: Number(protocolMatch[1]) };
  }

  const weekMatch = key.match(WEEK_RE);
  if (weekMatch) {
    return { group: "week", week: Number(weekMatch[1]) };
  }

  return { group: "other" };
}

export const OVERVIEW_GROUP = "overview";

export function overviewGroupLabel(bucketKey: string): string {
  if (bucketKey === "retro") return "Retro";
  if (bucketKey === "other") return "Other";
  const weekMatch = bucketKey.match(/^week-(\d+)$/);
  if (weekMatch) return `Week ${weekMatch[1]}`;
  return bucketKey;
}

function sortOverviewKeys(a: string, b: string): number {
  const rank = (key: string) => {
    if (key === "retro") return 0;
    if (key.startsWith("week-")) return 100 + Number(key.slice(5));
    if (key === "other") return 10_000;
    return 9_000;
  };
  return rank(a) - rank(b);
}

export function aggregateOverviewGroups(data: CategoryBreakdownItem[]): CategoryBreakdownItem[] {
  const buckets = new Map<string, number>();
  let totalPoints = 0;

  for (const item of data) {
    totalPoints += item.points;
    const parsed = parseAuraCategoryKey(item.key);
    const bucketKey =
      parsed.group === "retro"
        ? "retro"
        : parsed.group === "week"
          ? `week-${parsed.week}`
          : "other";
    buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + item.points);
  }

  return [...buckets.entries()]
    .map(([key, points]) => ({
      key,
      category: overviewGroupLabel(key),
      points,
      share: totalPoints > 0 ? (points / totalPoints) * 100 : 0,
    }))
    .sort((a, b) => sortOverviewKeys(a.key, b.key));
}

export function filterCategoryBreakdown(
  data: CategoryBreakdownItem[],
  selectedGroup: string
): CategoryBreakdownItem[] {
  if (selectedGroup === OVERVIEW_GROUP) {
    return aggregateOverviewGroups(data);
  }

  if (selectedGroup === "retro") {
    return data
      .filter((item) => parseAuraCategoryKey(item.key).group === "retro")
      .sort((a, b) => b.points - a.points);
  }

  if (selectedGroup === "other") {
    return data
      .filter((item) => parseAuraCategoryKey(item.key).group === "other")
      .sort((a, b) => b.points - a.points);
  }

  const weekMatch = selectedGroup.match(/^week-(\d+)$/);
  if (weekMatch) {
    const week = Number(weekMatch[1]);
    return data
      .filter((item) => {
        const parsed = parseAuraCategoryKey(item.key);
        return parsed.group === "week" && parsed.week === week;
      })
      .sort((a, b) => b.points - a.points);
  }

  return [...data].sort((a, b) => b.points - a.points);
}

export function buildCategoryGroupOptions(data: CategoryBreakdownItem[]) {
  const weeks = new Set<number>();
  let hasRetro = false;
  let hasOther = false;

  for (const item of data) {
    const parsed = parseAuraCategoryKey(item.key);
    if (parsed.group === "retro") hasRetro = true;
    if (parsed.group === "week" && parsed.week != null) weeks.add(parsed.week);
    if (parsed.group === "other") hasOther = true;
  }

  const options: { value: string; label: string }[] = [
    { value: OVERVIEW_GROUP, label: "Overview" },
  ];

  if (hasRetro) {
    options.push({ value: "retro", label: "Retro" });
  }

  for (const week of [...weeks].sort((a, b) => a - b)) {
    options.push({ value: `week-${week}`, label: `Week ${week}` });
  }

  if (hasOther) {
    options.push({ value: "other", label: "Other" });
  }

  return options;
}
