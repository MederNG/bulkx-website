import { NextResponse } from "next/server";
import {
  buildLiveExchangePayload,
  LIVE_EXCHANGE_TTL_MS,
} from "@/lib/live-exchange-payload";

/**
 * Explicitly dynamic. The metrics fetch behind this route uses `no-store`,
 * because TPS is a delta between consecutive readings and a cached one would
 * measure nothing. Declaring `revalidate` instead made Next try to render the
 * route statically, where a no-store fetch throws DynamicServerError — which
 * is how production ended up serving a payload of zeros.
 *
 * CDN caching is unaffected: it comes from the Cache-Control header below.
 */
export const dynamic = "force-dynamic";

const CACHE_CONTROL = `public, s-maxage=${Math.round(LIVE_EXCHANGE_TTL_MS / 1000)}, stale-while-revalidate=30`;

export async function GET() {
  try {
    const payload = await buildLiveExchangePayload();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json({ error: "Live exchange unavailable" }, { status: 503 });
  }
}
