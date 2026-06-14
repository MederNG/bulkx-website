import { NextRequest, NextResponse } from "next/server";
import { computeFdv, getRankTargets } from "@/lib/percentiles";
import { getLeaderboard } from "@/lib/fetcher";

export const revalidate = 300;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type } = body;

  if (type === "rank") {
    const entries = getLeaderboard();
    const sorted = entries.map((e) => e.aura).sort((a, b) => b - a);
    const targets = getRankTargets(sorted);
    const currentAura = Number(body.currentAura ?? 0);
    const targetKey = body.target ?? "top10Percent";

    const required = targets[targetKey as keyof typeof targets] ?? 0;
    return NextResponse.json({
      requiredAura: required,
      additionalAuraNeeded: Math.max(0, required - currentAura),
      targets,
    });
  }

  if (type === "fdv") {
    const userAura = Number(body.userAura ?? 0);
    const fdv = Number(body.fdv ?? 0);
    const allocation = Number(body.allocation ?? 30);
    const totalAuraSupply = Number(body.totalAuraSupply ?? 1);
    const result = computeFdv(userAura, fdv, allocation, totalAuraSupply);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid calculator type" }, { status: 400 });
}
