import { NextRequest, NextResponse } from "next/server";

import { dispatchRepositoryEvent, isAuthorizedCronRequest } from "@/lib/cron-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISPATCH_EVENT = "tvl-refresh";

/** Vercel Cron backup — triggers the daily TVL GitHub Action via repository_dispatch. */
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

  const result = await dispatchRepositoryEvent(token, DISPATCH_EVENT);
  if (result.ok) {
    return NextResponse.json({ ok: true, event: DISPATCH_EVENT });
  }

  return NextResponse.json(
    { error: "GitHub dispatch failed", status: result.status, detail: result.detail },
    { status: 502 },
  );
}
