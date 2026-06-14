"use client";

import { useMemo, useState } from "react";
import type { LeaderboardEntry } from "@/types";
import { formatNumber, formatUsd, truncateWallet } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "aura" | "deposit" | "efficiency" | "referral";

interface LeaderboardTableProps {
  initialData: LeaderboardEntry[];
}

export function LeaderboardTable({ initialData }: LeaderboardTableProps) {
  const [tab, setTab] = useState<Tab>("aura");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const sorted = useMemo(() => sortData(initialData, tab), [initialData, tab]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((e) => e.wallet.toLowerCase().includes(q));
  }, [sorted, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const tabs: { id: Tab; label: string }[] = [
    { id: "aura", label: "Aura Rank" },
    { id: "deposit", label: "Deposit Rank" },
    { id: "efficiency", label: "Efficiency" },
    { id: "referral", label: "Referral" },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[rgba(198,182,186,0.1)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={cn("btn-ghost", tab === t.id && "active")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search wallet..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input-field max-w-xs font-mono text-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[rgba(198,182,186,0.1)] text-text-secondary">
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium text-right">Aura</th>
              <th className="px-4 py-3 font-medium text-right">Deposit</th>
              {tab === "efficiency" && (
                <th className="px-4 py-3 font-medium text-right">Efficiency</th>
              )}
              {tab === "referral" && (
                <>
                  <th className="px-4 py-3 font-medium text-right">Sent</th>
                  <th className="px-4 py-3 font-medium text-right">Qualified</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.map((entry, i) => (
              <tr
                key={entry.wallet}
                className="border-b border-[rgba(198,182,186,0.05)] hover:bg-[rgba(255,181,71,0.03)]"
              >
                <td className="px-4 py-2.5 font-mono tabular-nums text-text-secondary">
                  #{(page - 1) * pageSize + i + 1}
                </td>
                <td className="px-4 py-2.5 font-mono">{truncateWallet(entry.wallet, 6)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">
                  {formatNumber(entry.aura)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {formatUsd(entry.current_amount)}
                </td>
                {tab === "efficiency" && (
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-bid-green">
                    {(entry.aura / Math.max(entry.deposited_amount, 1)).toFixed(3)}
                  </td>
                )}
                {tab === "referral" && (
                  <>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {entry.referrals_sent}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {entry.referrals_qualified}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[rgba(198,182,186,0.1)] px-4 py-3">
        <p className="text-xs text-text-secondary">
          Showing top {Math.min(100, filtered.length)} of {filtered.length.toLocaleString()}
        </p>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span className="flex items-center px-2 font-mono text-xs tabular-nums text-text-secondary">
            {page}/{totalPages}
          </span>
          <button
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function sortData(data: LeaderboardEntry[], tab: Tab): LeaderboardEntry[] {
  const copy = [...data];
  switch (tab) {
    case "deposit":
      return copy.sort((a, b) => a.deposit_rank - b.deposit_rank);
    case "efficiency":
      return copy
        .filter((e) => e.deposited_amount > 0)
        .sort((a, b) => b.aura / b.deposited_amount - a.aura / a.deposited_amount);
    case "referral":
      return copy.sort(
        (a, b) => b.referrals_qualified - a.referrals_qualified || b.aura - a.aura
      );
    default:
      return copy.sort((a, b) => a.aura_rank - b.aura_rank);
  }
}

export function ReferralTable({ data }: { data: LeaderboardEntry[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[rgba(198,182,186,0.1)] text-text-secondary">
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium text-right">Sent</th>
              <th className="px-4 py-3 font-medium text-right">Qualified</th>
              <th className="px-4 py-3 font-medium text-right">Rewarded</th>
              <th className="px-4 py-3 font-medium text-right">Aura</th>
              <th className="px-4 py-3 font-medium text-right">Referred Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((entry) => (
              <tr
                key={entry.wallet}
                className="border-b border-[rgba(198,182,186,0.05)] hover:bg-[rgba(255,181,71,0.03)]"
              >
                <td className="px-4 py-2.5 font-mono">{truncateWallet(entry.wallet, 6)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{entry.referrals_sent}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{entry.referrals_qualified}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{entry.referrals_rewarded}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">
                  {formatNumber(entry.aura)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {formatUsd(entry.referees_total_deposited ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EfficiencyTable({
  data,
}: {
  data: (LeaderboardEntry & { efficiency: number })[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[rgba(198,182,186,0.1)] text-text-secondary">
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium text-right">Aura</th>
              <th className="px-4 py-3 font-medium text-right">Deposit</th>
              <th className="px-4 py-3 font-medium text-right">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((entry) => (
              <tr
                key={entry.wallet}
                className="border-b border-[rgba(198,182,186,0.05)] hover:bg-[rgba(255,181,71,0.03)]"
              >
                <td className="px-4 py-2.5 font-mono">{truncateWallet(entry.wallet, 6)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">
                  {formatNumber(entry.aura)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {formatUsd(entry.deposited_amount)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-bid-green">
                  {entry.efficiency.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
