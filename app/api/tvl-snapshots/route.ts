import { NextResponse } from "next/server";
import { getLiveSnapshots } from "@/lib/live-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const snapshots = await getLiveSnapshots();
  return NextResponse.json(snapshots);
}
