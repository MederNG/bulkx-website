"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import {
  LEADERBOARD_TAB_DEFAULT_SORT,
  LEADERBOARD_TOP_LIMIT,
  type LeaderboardSortDir,
  type LeaderboardTab,
} from "@/lib/leaderboard-table";
import { formatNumber, formatUsd, truncateWallet } from "@/lib/utils";
import { computeDepositAura, computeEfficiency } from "@/lib/percentiles";
import { cn } from "@/lib/utils";

interface ColumnDef {
  key: string;
  label: string;
  align?: "left" | "right";
  isDisplayRank?: boolean;
  sortable?: boolean;
  render: (entry: LeaderboardEntry) => React.ReactNode;
}

function getColumns(tab: LeaderboardTab): ColumnDef[] {
  const rank: ColumnDef = {
    key: "rank",
    label: "Rank",
    align: "left",
    isDisplayRank: true,
    sortable: false,
    render: () => null,
  };

  const wallet: ColumnDef = {
    key: "wallet",
    label: "Wallet",
    align: "left",
    render: (entry) => <span className="font-mono">{truncateWallet(entry.wallet, 6)}</span>,
  };

  const aura: ColumnDef = {
    key: "aura",
    label: "Aura",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums text-accent">
        {formatNumber(tab === "efficiency" ? computeDepositAura(entry) : entry.aura)}
      </span>
    ),
  };

  const deposit: ColumnDef = {
    key: "deposit",
    label: "Deposit",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums">{formatUsd(entry.current_amount)}</span>
    ),
  };

  const depositedBasis: ColumnDef = {
    key: "deposited",
    label: "Deposit",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums">{formatUsd(entry.deposited_amount)}</span>
    ),
  };

  const referredAmount: ColumnDef = {
    key: "referees_total_deposited",
    label: "Referred Amount",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums">
        {formatUsd(entry.referees_total_deposited ?? 0)}
      </span>
    ),
  };

  const efficiency: ColumnDef = {
    key: "efficiency",
    label: "Efficiency",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums text-bid-green">
        {computeEfficiency(entry).toFixed(3)}
      </span>
    ),
  };

  const sent: ColumnDef = {
    key: "referrals_sent",
    label: "Sent",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums">{entry.referrals_sent}</span>
    ),
  };

  const qualified: ColumnDef = {
    key: "referrals_qualified",
    label: "Qualified",
    align: "right",
    render: (entry) => (
      <span className="font-mono tabular-nums">{entry.referrals_qualified}</span>
    ),
  };

  switch (tab) {
    case "deposit":
      return [rank, wallet, aura, deposit];
    case "efficiency":
      return [rank, wallet, aura, depositedBasis, efficiency];
    case "referral":
      return [rank, wallet, aura, referredAmount, sent, qualified];
    default:
      return [rank, wallet, aura, deposit];
  }
}

function defaultSortDirForKey(tab: LeaderboardTab, key: string): LeaderboardSortDir {
  const defaults = LEADERBOARD_TAB_DEFAULT_SORT[tab];
  if (key === defaults.key) return defaults.dir;
  if (key.endsWith("_rank")) return "asc";
  return "desc";
}

export function LeaderboardTable() {
  const [tab, setTab] = useState<LeaderboardTab>("aura");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(LEADERBOARD_TAB_DEFAULT_SORT.aura.key);
  const [sortDir, setSortDir] = useState<LeaderboardSortDir>(
    LEADERBOARD_TAB_DEFAULT_SORT.aura.dir
  );
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const columns = useMemo(() => getColumns(tab), [tab]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          tab,
          sort: sortKey,
          dir: sortDir,
          limit: String(LEADERBOARD_TOP_LIMIT),
        });
        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load leaderboard");
        const data = (await res.json()) as { items: LeaderboardEntry[] };
        if (!cancelled) setRows(data.items);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tab, sortKey, sortDir]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((entry) => entry.wallet.toLowerCase().includes(q));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleTabChange(nextTab: LeaderboardTab) {
    const defaults = LEADERBOARD_TAB_DEFAULT_SORT[nextTab];
    setTab(nextTab);
    setSortKey(defaults.key);
    setSortDir(defaults.dir);
    setPage(1);
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir(defaultSortDirForKey(tab, key));
    setPage(1);
  }

  const tabs: { id: LeaderboardTab; label: string }[] = [
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
              onClick={() => handleTabChange(t.id)}
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
              {columns.map((col) => (
                <SortableHeader
                  key={col.key}
                  label={col.label}
                  align={col.align}
                  sortable={col.sortable !== false}
                  active={sortKey === col.key}
                  direction={sortKey === col.key ? sortDir : null}
                  onClick={() => handleSort(col.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  Loading top {LEADERBOARD_TOP_LIMIT}…
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  No wallets found
                </td>
              </tr>
            ) : (
              pageData.map((entry, i) => (
                <tr
                  key={entry.wallet}
                  className="border-b border-[rgba(198,182,186,0.05)] hover:bg-[rgba(255,181,71,0.03)]"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5",
                        col.align === "right" ? "text-right" : "text-left",
                        col.isDisplayRank
                          ? "font-mono tabular-nums text-text-secondary"
                          : ""
                      )}
                    >
                      {col.isDisplayRank ? (
                        `#${(page - 1) * pageSize + i + 1}`
                      ) : (
                        col.render(entry)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[rgba(198,182,186,0.1)] px-4 py-3">
        <p className="text-xs text-text-secondary">
          {search.trim()
            ? `Showing ${pageData.length} of ${filtered.length} matches (top ${LEADERBOARD_TOP_LIMIT} in category)`
            : `Top ${LEADERBOARD_TOP_LIMIT} · showing ${pageData.length} of ${filtered.length}`}
        </p>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span className="flex items-center px-2 font-mono text-xs tabular-nums text-text-secondary">
            {page}/{totalPages}
          </span>
          <button
            className="btn-ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  align = "right",
  sortable,
  active,
  direction,
  onClick,
}: {
  label: string;
  align?: "left" | "right";
  sortable: boolean;
  active: boolean;
  direction: LeaderboardSortDir | null;
  onClick: () => void;
}) {
  const th = "px-4 py-3 font-medium";

  if (!sortable) {
    return (
      <th
        className={cn(
          th,
          align === "right" ? "text-right" : "text-left",
          "text-text-secondary"
        )}
      >
        {label}
      </th>
    );
  }

  return (
    <th className={cn(th, align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex w-full items-center gap-1 transition-colors",
          align === "right" ? "justify-end" : "justify-start",
          active ? "text-accent" : "text-text-secondary hover:text-text-primary"
        )}
      >
        {label}
        {active && direction === "desc" ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : active && direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <span className="inline-block h-3.5 w-3.5 shrink-0 opacity-0" aria-hidden />
        )}
      </button>
    </th>
  );
}
