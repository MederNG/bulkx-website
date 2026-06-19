import { NextResponse } from "next/server";
import { buildLiveFinancialPayload } from "@/lib/live-financial-payload";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const payload = await buildLiveFinancialPayload({ fresh: true });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Live financials unavailable" }, { status: 503 });
  }
}
