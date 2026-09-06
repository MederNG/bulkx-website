"use client";

import { useId, useState } from "react";
import { CHART_GOLD } from "@/lib/overview-metrics";
import { cn } from "@/lib/utils";

export type SparkRow = { t: number; value: number };

type SparkPt = SparkRow & { x: number; y: number };

const VW = 300;
const VH = 56;
const PAD_X = 2;
const PAD_TOP = 8;
const PAD_BOT = 4;

function geometry(rows: SparkRow[]): { line: string; area: string; pts: SparkPt[] } | null {
  if (rows.length < 1) return null;
  const source =
    rows.length === 1
      ? [{ t: rows[0].t - 60_000, value: rows[0].value }, rows[0]]
      : rows;
  const min = Math.min(...source.map((r) => r.value));
  const max = Math.max(...source.map((r) => r.value));
  const span = max - min || 1;
  const pts = source.map((row, i) => ({
    ...row,
    x: PAD_X + (i / (source.length - 1)) * (VW - PAD_X * 2),
    y: PAD_TOP + (1 - (row.value - min) / span) * (VH - PAD_TOP - PAD_BOT),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const first = pts[0];
  return {
    line,
    area: `${line} L${last.x.toFixed(1)},${VH} L${first.x.toFixed(1)},${VH} Z`,
    pts,
  };
}

export function MiniSpark({
  rows,
  formatValue,
  formatTime,
  edgeLabels = true,
}: {
  rows: SparkRow[];
  formatValue: (n: number) => string;
  formatTime: (t: number) => string;
  edgeLabels?: boolean;
}) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const geo = geometry(rows);
  const active = hover != null && geo ? geo.pts[hover] : null;

  function pick(clientX: number, target: HTMLElement) {
    if (!geo) return;
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * VW;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < geo.pts.length; i += 1) {
      const d = Math.abs(geo.pts[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  }

  if (!geo) return <div className="min-h-[64px] min-w-0 flex-1" />;

  const first = geo.pts[0];
  const last = geo.pts[geo.pts.length - 1];

  return (
    <div className="flex min-h-[56px] min-w-0 flex-1 flex-col justify-end">
      {edgeLabels ? (
        <div className={cn("mb-1 flex justify-between", active && "invisible")}>
          <span className="font-mono text-[10px] leading-none text-text-dim tabular-nums">
            {formatValue(first.value)}
          </span>
          <span className="font-mono text-[10px] leading-none text-text-dim tabular-nums">
            {formatValue(last.value)}
          </span>
        </div>
      ) : null}
      <div
        className="relative min-h-[44px] w-full flex-1 cursor-crosshair"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
      >
        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-[var(--color-line-strong)] bg-[#17171a] px-1.5 py-1 shadow-[0_10px_24px_rgba(0,0,0,.5)]"
            style={{
              left: `${(active.x / VW) * 100}%`,
              top: 0,
              transform:
                active.x > 220 ? "translate(-100%, 0)" : active.x < 40 ? "none" : "translate(-50%, 0)",
            }}
          >
            <p className="m-0 font-mono text-[9.5px] leading-none text-text-muted tabular-nums">
              {formatTime(active.t)}
            </p>
            <p className="m-0 mt-0.5 font-mono text-[10.5px] leading-none text-text-primary tabular-nums">
              {formatValue(active.value)}
            </p>
          </div>
        )}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 block h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_GOLD} stopOpacity="0.26" />
              <stop offset="100%" stopColor={CHART_GOLD} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geo.area} fill={`url(#${gradId})`} />
          <path
            d={geo.line}
            fill="none"
            stroke={CHART_GOLD}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={last.x} cy={last.y} r="2.6" fill={CHART_GOLD} />
          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1="0"
              y2={VH}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
