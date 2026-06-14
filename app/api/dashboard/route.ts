import { NextResponse } from "next/server";
import { computeDashboardMetrics } from "@/lib/stats";

export const revalidate = 300;

export async function GET() {
  const metrics = computeDashboardMetrics();
  return NextResponse.json(metrics);
}
