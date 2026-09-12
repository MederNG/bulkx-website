import { NextRequest, NextResponse } from "next/server";

import {
  dispatchRepositoryEvent,
  isAuthorizedCronRequest,
  lastSuccessfulRunAt,
} from "@/lib/cron-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISPATCH_EVENT = "aura-refresh";
const WORKFLOW_FILE = "weekly-aura-refresh.yml";
// The weekly job is a full leaderboard fetch with referral enrichment (~45 min), so
// only stand in for GitHub's own schedule when it has not already delivered today.
const FRESH_WINDOW_HOURS = 24;

/**
 * Vercel Cron backup — triggers the weekly Aura refresh via repository_dispatch, but
 * only when GitHub's own schedule failed to run it.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_DISPATCH_TOKEN is not configured" },
      { status: 503 },
    );
  }

  const lastRun = await lastSuccessfulRunAt(token, WORKFLOW_FILE);
  if (lastRun) {
    const ageHours = (Date.now() - new Date(lastRun).getTime()) / 3_600_000;
    if (ageHours < FRESH_WINDOW_HOURS) {
      return NextResponse.json({ ok: true, skipped: "already refreshed", lastRun });
    }
  }

  const result = await dispatchRepositoryEvent(token, DISPATCH_EVENT);
  if (result.ok) {
    return NextResponse.json({ ok: true, event: DISPATCH_EVENT, lastRun });
  }

  return NextResponse.json(
    { error: "GitHub dispatch failed", status: result.status, detail: result.detail },
    { status: 502 },
  );
}
