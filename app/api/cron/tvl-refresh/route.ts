import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GITHUB_REPO = "MederNG/bulkx-website";
const DISPATCH_EVENT = "tvl-refresh";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Vercel Cron backup — triggers the daily TVL GitHub Action via repository_dispatch. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_DISPATCH_TOKEN is not configured" },
      { status: 503 },
    );
  }

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: DISPATCH_EVENT }),
  });

  if (res.status === 204) {
    return NextResponse.json({ ok: true, event: DISPATCH_EVENT });
  }

  const detail = await res.text();
  return NextResponse.json(
    { error: "GitHub dispatch failed", status: res.status, detail },
    { status: 502 },
  );
}
