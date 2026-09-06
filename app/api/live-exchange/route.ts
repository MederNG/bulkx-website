import { NextResponse } from "next/server";
import {
  buildLiveExchangePayload,
  LIVE_EXCHANGE_TTL_MS,
} from "@/lib/live-exchange-payload";

export const revalidate = 15;

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
