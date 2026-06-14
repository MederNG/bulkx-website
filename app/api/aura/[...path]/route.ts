import { NextRequest, NextResponse } from "next/server";
import { upstreamFetch } from "@/lib/upstream";

export const revalidate = 300;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Shielded proxy for the BULK Aura indexer.
 *
 *   /api/aura/predeposit/leaderboard?page=1  ->  upstream /v1/aura/predeposit/leaderboard?page=1
 *   /api/aura/wallet/<addr>                  ->  upstream /v1/aura/wallet/<addr>
 *
 * The upstream host/base URL is never exposed to the client; everything is
 * fetched server-side with a controlled User-Agent, caching, and backoff.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const segments = path ?? [];
  let upstreamPath: string | null = null;

  // Guard proxy scope: only expose intended upstream Aura endpoints.
  if (segments.length === 2 && segments[0] === "predeposit" && segments[1] === "leaderboard") {
    upstreamPath = "/v1/aura/predeposit/leaderboard";
  } else if (segments.length === 2 && segments[0] === "wallet" && SOLANA_ADDRESS_RE.test(segments[1])) {
    upstreamPath = `/v1/aura/wallet/${segments[1]}`;
  }

  if (!upstreamPath) {
    return NextResponse.json({ error: "Unsupported path" }, { status: 400 });
  }

  const search = request.nextUrl.search;
  const upstreamUrlPath = `${upstreamPath}${search}`;

  try {
    const res = await upstreamFetch(upstreamUrlPath);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
