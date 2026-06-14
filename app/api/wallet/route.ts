import { NextRequest, NextResponse } from "next/server";
import { getWalletData } from "@/lib/stats";
import { upstreamJson } from "@/lib/upstream";
import { getLeaderboard } from "@/lib/fetcher";
import { computePercentile, computeEfficiency, computeHoldTimeDays } from "@/lib/percentiles";
import type { LeaderboardEntry, WalletData } from "@/types";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface UpstreamWallet {
  wallet: string;
  rank?: number;
  referrals_sent?: number;
  referrals_qualified?: number;
  referrals_rewarded?: number;
  deposited_amount?: number;
  withdrawn_amount?: number;
  current_amount?: number;
  total_held_time_seconds?: number;
  total_held_time_hours?: number;
  aura?: number;
  categories?: Record<string, number>;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }
  if (!SOLANA_ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  const local = getWalletData(address);
  if (local) {
    return NextResponse.json(local);
  }

  try {
    const remote = await upstreamJson<UpstreamWallet>(`/v1/aura/wallet/${address}`);
    if (remote) {
      const entry: LeaderboardEntry = {
        wallet: remote.wallet,
        aura: remote.aura ?? 0,
        aura_rank: remote.rank ?? 0,
        deposit_rank: 0,
        deposited_amount: remote.deposited_amount ?? 0,
        withdrawn_amount: remote.withdrawn_amount ?? 0,
        current_amount: remote.current_amount ?? 0,
        referrals_sent: remote.referrals_sent ?? 0,
        referrals_qualified: remote.referrals_qualified ?? 0,
        referrals_rewarded: remote.referrals_rewarded ?? 0,
        categories: remote.categories ?? {},
        total_held_time_seconds: remote.total_held_time_seconds ?? 0,
        total_held_time_hours: remote.total_held_time_hours ?? 0,
        updated_at: remote.updated_at,
      };
      const allAura = getLeaderboard().map((e) => e.aura);
      const wallet: WalletData = {
        ...entry,
        percentile: computePercentile(entry.aura, allAura),
        hold_time_days: computeHoldTimeDays(entry),
        efficiency: computeEfficiency(entry),
      };
      return NextResponse.json(wallet);
    }
  } catch {
    // fall through to 404
  }

  return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
}
