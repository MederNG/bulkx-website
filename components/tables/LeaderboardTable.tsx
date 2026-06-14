"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import { formatNumber, formatUsd, truncateWallet } from "@/lib/utils";
import { computeDepositAura, computeEfficiency } from "@/lib/percentiles";
import { cn } from "@/lib/utils";

type Tab = "aura" | "deposit" | "efficiency" | "referral";
type SortDir = "asc" | "desc";

interface LeaderboardTableProps {
  initialData: LeaderboardEntry[];
  referralData: LeaderboardEntry[];
}

interface ColumnDef {
  key: string;
  label: string;
  align?: "left" | "right";
  getSortValue: (entry: LeaderboardEntry) => number | string;
  render: (entry: LeaderboardEntry) => React.ReactNode;
}

const TAB_DEFAULT_SORT: Record<Tab, { key: string; dir: SortDir }> = {
  aura: { key: "aura_rank", dir: "asc" },
  deposit: { key: "deposit_rank", dir: "asc" },
  efficiency: { key: "efficiency", dir: "desc" },
  referral: { key: "referrals_qualified", dir: "desc" },
};

function getColumns(tab: Tab): ColumnDef[] {
  const rank: ColumnDef = {
    key: tab === "deposit" ? "deposit_rank" : "aura_rank",
    label: "Rank",
    align: "left",
    getSortValue: (entry) => (tab === "deposit" ? entry.deposit_rank : entry.aura_rank),
    render: () => null,
  };

  const wallet: ColumnDef = {
    key: "wallet",
    label: "Wallet",
    align: "left",
    getSortValue: (entry) => entry.wallet,
    render: (entry) => <span className="font-mono">{truncateWallet(entry.wallet, 6)}</span>,
  };

  const aura: ColumnDef = {
    key: "aura",
    label: "Aura",
    align: "right",
    getSortValue: (entry) => (tab === "efficiency" ? computeDepositAura(entry) : entry.aura),
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
    getSortValue: (entry) => entry.current_amount,
    render: (entry) => (
      <span className="font-mono tabular-nums">{formatUsd(entry.current_amount)}</span>
    ),
  };

  const referredAmount: ColumnDef = {
    key: "referees_total_deposited",
    label: "Referred Amount",
    align: "right",
    getSortValue: (entry) => entry.referees_total_deposited ?? 0,
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
    getSortValue: (entry) => computeEfficiency(entry),
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
    getSortValue: (entry) => entry.referrals_sent,
    render: (entry) => (
      <span className="font-mono tabular-nums">{entry.referrals_sent}</span>
    ),
  };

  const qualified: ColumnDef = {
    key: "referrals_qualified",
    label: "Qualified",
    align: "right",
    getSortValue: (entry) => entry.referrals_qualified,
    render: (entry) => (
      <span className="font-mono tabular-nums">{entry.referrals_qualified}</span>
    ),
  };

  switch (tab) {
    case "deposit":
      return [rank, wallet, aura, deposit];
    case "efficiency":
      return [rank, wallet, aura, deposit, efficiency];
    case "referral":
      return [rank, wallet, aura, referredAmount, sent, qualified];
    default:
      return [rank, wallet, aura, deposit];
  }
}

function filterByTab(data: LeaderboardEntry[], tab: Tab, referralData: LeaderboardEntry[]): LeaderboardEntry[] {
  if (tab === "efficiency") {
    return data.filter((e) => e.deposited_amount > 0 && computeDepositAura(e) > 0);
  }
  if (tab === "referral") {
    return referralData;
  }
  return data;
}

function sortEntries(
  data: LeaderboardEntry[],
  columns: ColumnDef[],
  sortKey: string,
  sortDir: SortDir
): LeaderboardEntry[] {
  const column = columns.find((col) => col.key === sortKey) ?? columns[0];
  const copy = [...data];

  copy.sort((a, b) => {
    const aVal = column.getSortValue(a);
    const bVal = column.getSortValue(b);

    if (typeof aVal === "string" && typeof bVal === "string") {
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "desc" ? -cmp : cmp;
    }

    const diff = Number(aVal) - Number(bVal);
    return sortDir === "desc" ? -diff : diff;
  });

  return copy;
}

export function LeaderboardTable({ initialData, referralData }: LeaderboardTableProps) {
  const [tab, setTab] = useState<Tab>("aura");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(TAB_DEFAULT_SORT.aura.key);
  const [sortDir, setSortDir] = useState<SortDir>(TAB_DEFAULT_SORT.aura.dir);
  const pageSize = 25;

  const columns = useMemo(() => getColumns(tab), [tab]);

  useEffect(() => {
    const defaults = TAB_DEFAULT_SORT[tab];
    setSortKey(defaults.key);
    setSortDir(defaults.dir);
    setPage(1);
  }, [tab]);

  const tabData = useMemo(
    () => filterByTab(initialData, tab, referralData),
    [initialData, tab, referralData]
  );

  const sorted = useMemo(
    () => sortEntries(tabData, columns, sortKey, sortDir),
    [tabData, columns, sortKey, sortDir]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((e) => e.wallet.toLowerCase().includes(q));
  }, [sorted, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  }

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
              onClick={() => setTab(t.id)}
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
                  active={sortKey === col.key}
                  direction={sortKey === col.key ? sortDir : null}
                  onClick={() => handleSort(col.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((entry, i) => (
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
                      col.key === "aura_rank" || col.key === "deposit_rank"
                        ? "font-mono tabular-nums text-text-secondary"
                        : ""
                    )}
                  >
                    {col.key === "aura_rank" || col.key === "deposit_rank" ? (
                      `#${(page - 1) * pageSize + i + 1}`
                    ) : (
                      col.render(entry)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[rgba(198,182,186,0.1)] px-4 py-3">
        <p className="text-xs text-text-secondary">
          Showing {pageData.length} of {filtered.length.toLocaleString()}
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

function SortableHeader({
  label,
  align = "right",
  active,
  direction,
  onClick,
}: {
  label: string;
  align?: "left" | "right";
  active: boolean;
  direction: SortDir | null;
  onClick: () => void;
}) {
  return (
    <th className={cn("px-4 py-3 font-medium", align === "right" ? "text-right" : "text-left")}>
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
