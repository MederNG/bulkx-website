import { NextResponse } from "next/server";
import {
  buildLiveFinancialPayload,
  LIVE_PAYLOAD_TTL_MS,
} from "@/lib/live-financial-payload";

/** CDN + Next data cache: one rebuild per TTL, not one per open tab. */
export const revalidate = 45;

const CACHE_CONTROL = `public, s-maxage=${Math.round(LIVE_PAYLOAD_TTL_MS / 1000)}, stale-while-revalidate=90`;

export async function GET() {
  try {
    const payload = await buildLiveFinancialPayload();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json({ error: "Live financials unavailable" }, { status: 503 });
  }
}
