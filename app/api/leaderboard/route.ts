import { NextRequest, NextResponse } from "next/server";
import { getSortedLeaderboard } from "@/lib/stats";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab") ?? "aura";
  const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const pageSize = Number(request.nextUrl.searchParams.get("page_size") ?? 25);

  const validTabs = ["aura", "deposit", "efficiency", "referral"] as const;
  const selectedTab = validTabs.includes(tab as (typeof validTabs)[number])
    ? (tab as (typeof validTabs)[number])
    : "aura";

  const all = getSortedLeaderboard(selectedTab);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return NextResponse.json({
    items,
    total: all.length,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(all.length / pageSize),
  });
}
