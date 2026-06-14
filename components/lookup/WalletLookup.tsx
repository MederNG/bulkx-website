"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { WalletData } from "@/types";
import { formatNumber, formatUsd, truncateWallet } from "@/lib/utils";

export function WalletLookup() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/wallet?address=${encodeURIComponent(address.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Wallet not found");
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card-highlight p-4 md:p-5">
      <p className="section-title mb-3">Wallet Lookup</p>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Solana wallet address..."
          className="input-field font-mono text-sm"
        />
        <button type="submit" className="btn-primary flex shrink-0 items-center gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-ask-red">{error}</p>}

      {result && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Wallet" value={truncateWallet(result.wallet, 6)} mono />
          <Stat label="Aura Rank" value={`#${result.aura_rank.toLocaleString()}`} mono />
          <Stat label="Aura" value={formatNumber(result.aura)} mono accent />
          <Stat label="Percentile" value={`Top ${(100 - result.percentile).toFixed(1)}%`} mono />
          <Stat label="Deposit Rank" value={`#${result.deposit_rank.toLocaleString()}`} mono />
          <Stat label="Deposited" value={formatUsd(result.deposited_amount)} mono />
          <Stat label="Withdrawn" value={formatUsd(result.withdrawn_amount)} mono />
          <Stat label="Current" value={formatUsd(result.current_amount)} mono />
          <Stat label="Referrals Sent" value={result.referrals_sent.toString()} mono />
          <Stat label="Qualified" value={result.referrals_qualified.toString()} mono />
          <Stat label="Rewarded" value={result.referrals_rewarded.toString()} mono />
          <Stat label="Efficiency" value={`${result.efficiency.toFixed(3)} A/$`} mono />
          <Stat label="Wallet Age" value={`~${result.wallet_age_estimate_days} days`} mono />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded border border-[rgba(198,182,186,0.08)] bg-bulk-base p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</p>
      <p
        className={`mt-1 text-sm font-medium tabular-nums ${mono ? "font-mono" : ""} ${accent ? "text-accent" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
