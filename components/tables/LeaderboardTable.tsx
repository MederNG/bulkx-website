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
import { CopyableWallet } from "@/components/ui/CopyableWallet";
import { PageHeading } from "@/components/layout/PageHeading";
import { PanelCard } from "@/components/overview/PanelCard";

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
    render: (entry) => <WalletCell wallet={entry.wallet} />,
  };

  const aura: ColumnDef = {
    key: "aura",
    label: "Aura",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums text-accent">
        {formatNumber(tab === "efficiency" ? computeDepositAura(entry) : entry.aura)}
      </span>
    ),
  };

  const deposit: ColumnDef = {
    key: "deposit",
    label: "Deposit",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums">{formatUsd(entry.current_amount)}</span>
    ),
  };

  const depositedBasis: ColumnDef = {
    key: "deposited",
    label: "Deposit",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums">{formatUsd(entry.deposited_amount)}</span>
    ),
  };

  const referredAmount: ColumnDef = {
    key: "referees_total_deposited",
    label: "Referred Amount",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums">
        {formatUsd(entry.referees_total_deposited ?? 0)}
      </span>
    ),
  };

  const efficiency: ColumnDef = {
    key: "efficiency",
    label: "Efficiency",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums text-bid-green">
        {computeEfficiency(entry).toFixed(3)}
      </span>
    ),
  };

  const sent: ColumnDef = {
    key: "referrals_sent",
    label: "Sent",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums">{entry.referrals_sent}</span>
    ),
  };

  const qualified: ColumnDef = {
    key: "referrals_qualified",
    label: "Qualified",
    align: "right",
    render: (entry) => (
      <span className="tabular-nums">{entry.referrals_qualified}</span>
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
  // Bumped on every press and used as the underline's key, so the mark
  // restarts even when the tab pressed is the one already open. Same control
  // as the tools page — see the note on .switch-underline.
  const [tabClickCount, setTabClickCount] = useState(0);
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
    <div className="flex flex-col gap-4">
      {/* The rank tabs ride the bottom edge of the heading card, the way the
          tool tabs do on /tools. They choose what the page IS, which is the
          heading's own question — as a strip of ghost buttons above the table
          they read as one more table control, alongside search and paging. */}
      <PageHeading eyebrow="Leaderboards" title="Top wallets" centered>
        <div className="flex flex-wrap items-center justify-center gap-7">
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  handleTabChange(t.id);
                  setTabClickCount((n) => n + 1);
                }}
                aria-pressed={on}
                // -mb-px drops the button's bottom edge onto the card's own
                // border so the underline lands on it rather than above it.
                className={cn(
                  "relative -mb-px cursor-pointer pb-2.5 text-[13px] font-medium transition-colors",
                  on ? "text-accent" : "text-text-muted hover:text-text-primary"
                )}
              >
                {t.label}
                {on && (
                  <span
                    key={tabClickCount}
                    className="switch-underline pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[linear-gradient(90deg,transparent_0%,var(--color-accent)_22%,var(--color-accent)_78%,transparent_100%)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PageHeading>

      <PanelCard glossy glossDelay={-11} className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--color-line)] p-4 sm:flex-row sm:items-center sm:justify-end">
          <input
            type="text"
            placeholder="Search wallet..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field max-w-xs text-[13px]"
          />
        </div>

      <div className={cn("overflow-x-auto", loading && "min-h-[680px]")}>
        <table className="w-full text-left text-[13px] text-text-primary">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
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
                  className="px-4 py-8 text-center text-text-muted"
                >
                  Loading top {LEADERBOARD_TOP_LIMIT}…
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-text-muted"
                >
                  No wallets found
                </td>
              </tr>
            ) : (
              pageData.map((entry, i) => (
                <tr
                  key={entry.wallet}
                  className="group border-b border-[var(--color-line-soft)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  {columns.map((col) => {
                    const value = col.isDisplayRank
                      ? `#${(page - 1) * pageSize + i + 1}`
                      : col.render(entry);
                    const alignRight = col.align === "right";
                    const sortable = col.sortable !== false;
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-2.5",
                          alignRight ? "text-right" : "text-left",
                          col.isDisplayRank && "tabular-nums text-text-muted"
                        )}
                      >
                        {alignRight && sortable ? (
                          <span className="inline-flex w-full items-center justify-end gap-1">
                            {value}
                            <SortIconSlot />
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-3">
        <p className="text-[13px] text-text-muted">
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
          <span className="flex items-center px-2 text-[13px] tabular-nums text-text-muted">
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
      </PanelCard>
    </div>
  );
}

function WalletCell({ wallet }: { wallet: string }) {
  return <CopyableWallet wallet={wallet} display={truncateWallet(wallet, 6)} />;
}

/** Same box the sort chevron occupies, so right-aligned figures sit on the
 * header label rather than sliding under the icon. Empty in the body; the
 * header fills it with the chevron. */
function SortIconSlot({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      {children}
    </span>
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
  const th = "px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em]";

  if (!sortable) {
    return (
      <th
        className={cn(
          th,
          align === "right" ? "text-right" : "text-left",
          "text-text-muted"
        )}
      >
        {label}
      </th>
    );
  }

  const Icon = active && direction === "asc" ? ChevronUp : ChevronDown;

  return (
    <th className={cn(th, align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex w-full items-center gap-1 transition-colors",
          align === "right" ? "justify-end" : "justify-start",
          active ? "text-accent" : "text-text-muted hover:text-text-primary"
        )}
      >
        {label}
        <SortIconSlot>
          <Icon
            className={cn("h-3.5 w-3.5", active ? "text-accent" : "text-text-dim")}
          />
        </SortIconSlot>
      </button>
    </th>
  );
}
