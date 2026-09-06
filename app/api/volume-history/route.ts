import { NextResponse } from "next/server";
import {
  VOLUME_RANGES,
  buildAllTimeHourly,
  buildVolumeHistory,
  type VolumeRange,
} from "@/lib/volume-history";

export const revalidate = 60;

function isVolumeRange(value: string | null): value is VolumeRange {
  return VOLUME_RANGES.includes(value as VolumeRange);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: VolumeRange = isVolumeRange(rangeParam) ? rangeParam : "1D";
  const hourlyAll = range === "ALL" && url.searchParams.get("interval") === "1h";

  try {
    const payload = hourlyAll ? await buildAllTimeHourly() : await buildVolumeHistory(range);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ error: "Volume history unavailable" }, { status: 503 });
  }
}
