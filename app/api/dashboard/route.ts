import { NextResponse } from "next/server";
import { computeDashboardMetrics } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const metrics = await computeDashboardMetrics();
  return NextResponse.json(metrics);
}