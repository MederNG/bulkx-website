import { NextResponse } from "next/server";
import { getLiveTotals } from "@/lib/live-totals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const totals = await getLiveTotals();
  if (!totals) {
    return NextResponse.json({ error: "Totals unavailable" }, { status: 503 });
  }
  return NextResponse.json(totals);
}
