"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_GOLD, chartPrimaryRamp } from "@/lib/overview-metrics";
import {
  VOLUME_COINS,
  VOLUME_RANGES,
  type VolumeBucket,
  type VolumeCoin,
  type VolumeHistoryPayload,
  type VolumeRange,
} from "@/lib/volume-history";
import {
  OVERVIEW_BAR_GAP,
  OVERVIEW_BAR_RADIUS,
  OVERVIEW_BAR_W,
} from "@/lib/overview-bars";
import { cn, formatUsd } from "@/lib/utils";

const COIN_META: Record<VolumeCoin, { label: string; color: string }> = {
  btc: { label: "BTC", color: chartPrimaryRamp(0, 4) },
  eth: { label: "ETH", color: chartPrimaryRamp(1, 4) },
  sol: { label: "SOL", color: chartPrimaryRamp(2, 4) },
  others: { label: "Others", color: chartPrimaryRamp(3, 4) },
};

const AXIS_TICK = {
  fill: "#8b8580",
  fontSize: 11,
  fontFamily: "var(--font-overpass-mono), ui-monospace, monospace",
} as const;

function usdCompact(value: number): string {
  return formatUsd(value);
}

function formatAxisTick(t: number, range: VolumeRange): string {
  const date = new Date(t);
  if (range === "1D") {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalised = rough / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

export function VolumeChart() {
  const [range, setRange] = useState<VolumeRange>("1D");
  const [enabled, setEnabled] = useState<Record<VolumeCoin, boolean>>({
    btc: true,
    eth: true,
    sol: true,
    others: false,
  });
  const [showCumulative, setShowCumulative] = useState(true);
  const [payload, setPayload] = useState<VolumeHistoryPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    void fetch(`/api/volume-history?range=${range}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((next: VolumeHistoryPayload | null) => {
        if (!cancelled && next) setPayload(next);
      })
      .catch(() => {
        if (!cancelled) setPayload({ range, interval: "1h", buckets: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const rows = useMemo(() => {
    const buckets = payload?.buckets ?? [];
    let running = 0;
    return buckets.map((b) => {
      const visible: VolumeBucket = {
        ...b,
        btc: enabled.btc ? b.btc : 0,
        eth: enabled.eth ? b.eth : 0,
        sol: enabled.sol ? b.sol : 0,
        others: enabled.others ? b.others : 0,
        total: 0,
        cumulative: 0,
      };
      visible.total = visible.btc + visible.eth + visible.sol + visible.others;
      running += visible.total;
      visible.cumulative = running;
      return visible;
    });
  }, [payload, enabled]);

  const barMax = Math.max(0, ...rows.map((r) => r.total));
  const cumMax = Math.max(0, ...rows.map((r) => r.cumulative));
  const barStep = niceStep(barMax / 4);
  const cumStep = niceStep(cumMax / 4);
  const barHi = Math.max(barStep, Math.ceil(barMax / barStep) * barStep);
  const cumHi = Math.max(cumStep, Math.ceil(cumMax / cumStep) * cumStep);
  const lastEnabled = [...VOLUME_COINS].reverse().find((coin) => enabled[coin]) ?? null;

  function toggleCoin(coin: VolumeCoin) {
    setEnabled((prev) => ({ ...prev, [coin]: !prev[coin] }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="font-label m-0 text-text-muted">Total Volume</p>
        <div className="term-seg min-w-[240px]">
          {VOLUME_RANGES.map((r) => {
            const on = r === range;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={on}
                className={cn("term-seg-btn", on ? "is-on" : "is-off")}
              >
                {on && (
                  <motion.span
                    layoutId="volume-range-pill"
                    className="term-seg-pill"
                    aria-hidden="true"
                    transition={{ type: "spring", stiffness: 480, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-text-muted select-none">
        {VOLUME_COINS.map((coin) => {
          const on = enabled[coin];
          const meta = COIN_META[coin];
          return (
            <button
              key={coin}
              type="button"
              onClick={() => toggleCoin(coin)}
              className={cn(
                "inline-flex items-center gap-[7px] transition-opacity",
                on ? "text-text-secondary" : "opacity-40",
              )}
            >
              <span
                className="h-2 w-2 rounded-[1px]"
                style={{ background: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCumulative((v) => !v)}
          className={cn(
            "inline-flex items-center gap-[7px] transition-opacity",
            showCumulative ? "text-text-secondary" : "opacity-40",
          )}
        >
          <span className="h-[2px] w-4 bg-accent" />
          Cumulative
        </button>
      </div>

      <div className="relative mt-2 min-h-[220px] flex-1 overflow-hidden xl:min-h-0">
        {!payload ? (
          <p className="font-data m-0 pt-10 text-center text-text-dim">Loading volume…</p>
        ) : rows.length === 0 ? (
          <p className="font-data m-0 pt-10 text-center text-text-dim">No volume in this window.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={90}>
            <ComposedChart
              data={rows}
              margin={{ top: 6, right: 8, bottom: 4, left: 8 }}
              barCategoryGap={OVERVIEW_BAR_GAP}
              barGap={0}
            >
              <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t) => formatAxisTick(Number(t), range)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                height={26}
              />
              <YAxis
                yAxisId="bar"
                orientation="left"
                domain={[0, barHi]}
                tickFormatter={(v) => usdCompact(Number(v))}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <YAxis
                yAxisId="cum"
                orientation="right"
                domain={[0, cumHi]}
                tickFormatter={(v) => usdCompact(Number(v))}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={({ active, payload: tip, label }) => {
                  if (!active || !tip?.length) return null;
                  const row = tip[0]?.payload as VolumeBucket | undefined;
                  if (!row) return null;
                  return (
                    <div className="rounded-lg border border-[var(--color-line-strong)] bg-[#17171a] px-2.5 py-2 text-[11px] shadow-[0_14px_36px_rgba(0,0,0,.55)]">
                      <p className="font-data m-0 mb-1.5 text-text-muted">
                        {formatAxisTick(Number(label), range)}
                      </p>
                      {VOLUME_COINS.filter((c) => enabled[c] && row[c] > 0).map((c) => (
                        <p key={c} className="m-0 flex justify-between gap-6 text-text-secondary">
                          <span>{COIN_META[c].label}</span>
                          <span className="font-data text-text-primary">{usdCompact(row[c])}</span>
                        </p>
                      ))}
                      <p className="m-0 mt-1 flex justify-between gap-6 text-text-secondary">
                        <span>Total</span>
                        <span className="font-data text-text-primary">{usdCompact(row.total)}</span>
                      </p>
                      {showCumulative && (
                        <p className="m-0 flex justify-between gap-6 text-accent">
                          <span>Cumulative</span>
                          <span className="font-data">{usdCompact(row.cumulative)}</span>
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {VOLUME_COINS.map((coin) =>
                enabled[coin] ? (
                  <Bar
                    key={coin}
                    yAxisId="bar"
                    dataKey={coin}
                    stackId="vol"
                    fill={COIN_META[coin].color}
                    barSize={OVERVIEW_BAR_W}
                    radius={
                      coin === lastEnabled
                        ? [OVERVIEW_BAR_RADIUS, OVERVIEW_BAR_RADIUS, 0, 0]
                        : 0
                    }
                  />
                ) : null,
              )}
              {showCumulative && (
                <Line
                  yAxisId="cum"
                  type="monotone"
                  dataKey="cumulative"
                  stroke={CHART_GOLD}
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 3, fill: CHART_GOLD }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
