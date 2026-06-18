"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { RankTargets } from "@/types";
import { FDV_SCENARIOS, cn, formatNumber, formatUsd } from "@/lib/utils";
import { computeFdv } from "@/lib/percentiles";
import { Select } from "@/components/ui/Select";
import { CopyCardPngButton, ExportField, ToolExportSurface } from "@/components/calculator/CopyCardPngButton";

const FDV_FUD_THRESHOLD = 500_000_000;

interface RankCalculatorProps {
  targets: RankTargets;
}

export function RankCalculator({ targets }: RankCalculatorProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [currentAura, setCurrentAura] = useState(100);
  const [selectedTarget, setSelectedTarget] = useState<keyof RankTargets>("top10Percent");

  const targetOptions: { key: keyof RankTargets; label: string }[] = [
    { key: "top10Percent", label: "Top 10%" },
    { key: "top5Percent", label: "Top 5%" },
    { key: "top1Percent", label: "Top 1%" },
    { key: "top100", label: "Top 100" },
    { key: "top50", label: "Top 50" },
    { key: "top10", label: "Top 10" },
  ];

  const required = targets[selectedTarget];
  const additional = Math.max(0, required - currentAura);
  const targetLabel = targetOptions.find((option) => option.key === selectedTarget)?.label ?? "";

  return (
    <>
      <div className="card p-4 md:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="section-title">Rank Target Calculator</p>
          <CopyCardPngButton exportRef={exportRef} filename="rank-target-calculator" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">Current Aura</label>
            <NumericInput value={currentAura} onChange={setCurrentAura} className="input-field font-mono tabular-nums" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">Target</label>
            <Select
              value={selectedTarget}
              onChange={(v) => setSelectedTarget(v as keyof RankTargets)}
              options={targetOptions.map((o) => ({ value: o.key, label: o.label }))}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox label="Required Aura" value={formatNumber(required)} />
          <ResultBox label="Additional Aura Needed" value={formatNumber(additional)} accent={additional > 0} />
        </div>
      </div>
      <ToolExportSurface exportRef={exportRef} width={560}>
        <p className="section-title mb-4">Rank Target Calculator</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ExportField label="Current Aura" value={formatNumber(currentAura)} />
          <ExportField label="Target" value={targetLabel} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox label="Required Aura" value={formatNumber(required)} />
          <ResultBox label="Additional Aura Needed" value={formatNumber(additional)} accent={additional > 0} />
        </div>
      </ToolExportSurface>
    </>
  );
}

interface FdvEstimatorProps {
  userAura: number;
  setUserAura: (v: number) => void;
  fdv: number;
  setFdv: (v: number) => void;
  allocation: number;
  setAllocation: (v: number) => void;
  auraSupply: number;
  setAuraSupply: (v: number) => void;
  fdvAnchorRef: React.RefObject<HTMLDivElement | null>;
  onFudVisibilityChange: (visible: boolean) => void;
}

export function FdvEstimator({
  userAura,
  setUserAura,
  fdv,
  setFdv,
  allocation,
  setAllocation,
  auraSupply,
  setAuraSupply,
  fdvAnchorRef,
  onFudVisibilityChange,
}: FdvEstimatorProps) {
  const exportRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () => computeFdv(userAura, fdv, allocation, auraSupply),
    [userAura, fdv, allocation, auraSupply]
  );
  const fdvLabel = fdv >= 1_000_000_000
    ? `${(fdv / 1_000_000_000).toFixed(fdv % 1_000_000_000 === 0 ? 0 : 1)}B`
    : `${Math.round(fdv / 1_000_000)}M`;

  return (
    <>
      <div className="card overflow-visible p-4 md:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="section-title">FDV Estimator</p>
          <CopyCardPngButton exportRef={exportRef} filename="fdv-estimator" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Your Aura" value={userAura} onChange={setUserAura} />
          <FdvField
            fdv={fdv}
            onFdvChange={setFdv}
            anchorRef={fdvAnchorRef}
            onFudVisibilityChange={onFudVisibilityChange}
          />
          <Field label="Allocation (%)" value={allocation} onChange={setAllocation} max={100} />
          <Field label="Total Aura Supply" value={auraSupply} onChange={setAuraSupply} step={100_000} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultBox label="Pool Value" value={formatUsd(result.poolValue)} />
          <ResultBox label="Aura Value" value={`$${result.auraValue.toFixed(4)}`} />
          <ResultBox label="Your Value" value={formatUsd(result.userValue)} accent />
        </div>
      </div>
      <ToolExportSurface exportRef={exportRef} width={720}>
        <p className="section-title mb-4">FDV Estimator</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ExportField label="Your Aura" value={formatNumber(userAura)} />
          <ExportField label="FDV ($)" value={fdvLabel} />
          <ExportField label="Allocation (%)" value={String(allocation)} />
          <ExportField label="Total Aura Supply" value={formatNumber(auraSupply)} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultBox label="Pool Value" value={formatUsd(result.poolValue)} />
          <ResultBox label="Aura Value" value={`$${result.auraValue.toFixed(4)}`} />
          <ResultBox label="Your Value" value={formatUsd(result.userValue)} accent />
        </div>
      </ToolExportSurface>
    </>
  );
}

export function CalculatorSection({
  targets,
  totalAuraSupply,
}: {
  targets: RankTargets;
  totalAuraSupply: number;
}) {
  const fdvAnchorRef = useRef<HTMLDivElement>(null);
  const fudDockRef = useRef<HTMLDivElement>(null);
  const [showFud, setShowFud] = useState(false);
  const [userAura, setUserAura] = useState(500);
  const [fdv, setFdv] = useState(500_000_000);
  const [allocation, setAllocation] = useState(30);
  const [auraSupply, setAuraSupply] = useState(Math.round(totalAuraSupply));

  return (
    <>
      {showFud && (
        <FudWarningModal
          startAnchorRef={fdvAnchorRef}
          endAnchorRef={fudDockRef}
          onClose={() => setShowFud(false)}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankCalculator targets={targets} />
        <FdvEstimator
          userAura={userAura}
          setUserAura={setUserAura}
          fdv={fdv}
          setFdv={setFdv}
          allocation={allocation}
          setAllocation={setAllocation}
          auraSupply={auraSupply}
          setAuraSupply={setAuraSupply}
          fdvAnchorRef={fdvAnchorRef}
          onFudVisibilityChange={setShowFud}
        />
        <FdvMatrix userAura={userAura} allocation={allocation} totalAuraSupply={auraSupply} />
        <div
          ref={fudDockRef}
          className="relative hidden min-h-[280px] lg:block"
          aria-hidden="true"
        />
      </div>
    </>
  );
}

export function FdvMatrix({
  userAura,
  totalAuraSupply,
  allocation = 30,
}: {
  userAura: number;
  totalAuraSupply: number;
  allocation?: number;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const rows = FDV_SCENARIOS.map((fdv) => {
    const { userValue, auraValue } = computeFdv(userAura, fdv, allocation, totalAuraSupply);
    return {
      fdv: `$${(fdv / 1e6).toFixed(0)}M`,
      auraValue: `$${auraValue.toFixed(4)}`,
      userValue: formatUsd(userValue),
    };
  });

  return (
    <>
      <div className="card">
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(198,182,186,0.1)] p-4">
          <div>
            <p className="section-title">FDV Scenario Matrix</p>
            <p className="mt-1 text-xs text-text-secondary">
              Based on {userAura.toLocaleString()} Aura · {allocation}% allocation
            </p>
          </div>
          <CopyCardPngButton exportRef={exportRef} filename="fdv-scenario-matrix" />
        </div>
        <FdvMatrixTable rows={rows} />
      </div>
      <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-100" aria-hidden="true">
        <div ref={exportRef} className="card" style={{ width: 520 }}>
          <div className="border-b border-[rgba(198,182,186,0.1)] p-4">
            <p className="section-title">FDV Scenario Matrix</p>
            <p className="mt-1 text-xs text-text-secondary">
              Based on {userAura.toLocaleString()} Aura · {allocation}% allocation
            </p>
          </div>
          <FdvMatrixTable rows={rows} />
        </div>
      </div>
    </>
  );
}

function FdvMatrixTable({
  rows,
}: {
  rows: { fdv: string; auraValue: string; userValue: string }[];
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-[rgba(198,182,186,0.1)] text-text-secondary">
          <th className="px-4 py-3 font-medium">FDV</th>
          <th className="px-4 py-3 font-medium text-right">Aura Value</th>
          <th className="px-4 py-3 font-medium text-right">Your Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.fdv} className="border-b border-[rgba(198,182,186,0.05)]">
            <td className="px-4 py-2.5 font-mono font-medium">{row.fdv}</td>
            <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.auraValue}</td>
            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">{row.userValue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-secondary">{label}</label>
      <NumericInput
        value={value}
        onChange={onChange}
        step={step}
        max={max}
        disabled={disabled}
        className="input-field font-mono tabular-nums disabled:opacity-50"
      />
    </div>
  );
}

type FdvUnit = "M" | "B";

const FDV_UNIT_MULTIPLIER: Record<FdvUnit, number> = {
  M: 1_000_000,
  B: 1_000_000_000,
};

function formatFdvDisplay(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function FdvField({
  fdv,
  onFdvChange,
  anchorRef,
  onFudVisibilityChange,
}: {
  fdv: number;
  onFdvChange: (v: number) => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onFudVisibilityChange: (visible: boolean) => void;
}) {
  const [unit, setUnit] = useState<FdvUnit>("M");
  const [draft, setDraft] = useState(() => formatFdvDisplay(fdv / FDV_UNIT_MULTIPLIER.M));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatFdvDisplay(fdv / FDV_UNIT_MULTIPLIER[unit]));
    }
  }, [fdv, unit, isFocused]);

  useEffect(() => {
    if (fdv >= FDV_FUD_THRESHOLD) {
      onFudVisibilityChange(false);
    }
  }, [fdv, onFudVisibilityChange]);

  const applyFdv = (nextFdv: number) => {
    onFdvChange(nextFdv);
    if (nextFdv >= FDV_FUD_THRESHOLD || nextFdv <= 0) {
      onFudVisibilityChange(false);
    } else if (nextFdv < FDV_FUD_THRESHOLD) {
      onFudVisibilityChange(true);
    }
  };

  const commitDraft = (nextDraft: string, nextUnit: FdvUnit = unit) => {
    const trimmed = nextDraft.trim();
    if (trimmed === "") {
      applyFdv(0);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    applyFdv(parsed * FDV_UNIT_MULTIPLIER[nextUnit]);
  };

  const selectUnit = (nextUnit: FdvUnit) => {
    if (nextUnit === unit) return;
    setUnit(nextUnit);
    if (isFocused && draft.trim() !== "") {
      commitDraft(draft, nextUnit);
      return;
    }
    setDraft(formatFdvDisplay(fdv / FDV_UNIT_MULTIPLIER[nextUnit]));
  };

  return (
    <div ref={anchorRef} className="relative">
      <label className="mb-1 block text-xs text-text-secondary">FDV ($)</label>
      <div className="flex gap-1.5">
        <input
          type="number"
          value={draft}
          min={0}
          step={unit === "M" ? 1 : 0.1}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "") {
              setDraft("0");
              applyFdv(0);
              return;
            }
            commitDraft(draft);
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (next.trim() === "") return;
            const parsed = Number(next);
            if (!Number.isFinite(parsed) || parsed < 0) return;
            applyFdv(parsed * FDV_UNIT_MULTIPLIER[unit]);
          }}
          className="input-field min-w-0 flex-1 font-mono tabular-nums"
        />
        <div className="flex shrink-0 gap-0.5">
          {(["M", "B"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectUnit(key)}
              className={cn(
                "btn-ghost !min-w-[2.25rem] !px-2 !py-0 font-mono text-xs font-semibold",
                unit === key && "active"
              )}
              aria-pressed={unit === key}
              title={key === "M" ? "Millions" : "Billions"}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-text-secondary">
        {unit === "M" ? "Millions USD" : "Billions USD"} · ${formatNumber(fdv)}
      </p>
    </div>
  );
}

function useFudScrollPosition(
  startAnchorRef: React.RefObject<HTMLDivElement | null>,
  endAnchorRef: React.RefObject<HTMLDivElement | null>
) {
  const [position, setPosition] = useState({ top: 0, left: 0, progress: 0 });

  useEffect(() => {
    const updatePosition = () => {
      const start = startAnchorRef.current;
      const end = endAnchorRef.current;
      if (!start) return;

      const startRect = start.getBoundingClientRect();
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const startPoint = isDesktop
        ? {
            top: startRect.bottom + 56,
            left: startRect.right + 64,
          }
        : {
            top: startRect.bottom + 32,
            left: startRect.left + startRect.width / 2,
          };
      let progress = 0;
      let endPoint = startPoint;

      if (isDesktop && end) {
        const endRect = end.getBoundingClientRect();
        endPoint = {
          top: endRect.top + endRect.height * 0.42,
          left: endRect.left + endRect.width * 0.5,
        };

        const section = document.getElementById("calculator");
        if (section) {
          const sectionRect = section.getBoundingClientRect();
          const scrollRange = Math.max(section.offsetHeight - window.innerHeight * 0.45, 1);
          const scrolled = Math.min(Math.max(-sectionRect.top + 80, 0), scrollRange);
          progress = scrolled / scrollRange;
        }
      }

      setPosition({
        top: startPoint.top + (endPoint.top - startPoint.top) * progress,
        left: startPoint.left + (endPoint.left - startPoint.left) * progress,
        progress,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true, capture: true });
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.removeEventListener("resize", updatePosition);
    };
  }, [startAnchorRef, endAnchorRef]);

  return position;
}

function FudWarningModal({
  startAnchorRef,
  endAnchorRef,
  onClose,
}: {
  startAnchorRef: React.RefObject<HTMLDivElement | null>;
  endAnchorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const { top, left, progress } = useFudScrollPosition(startAnchorRef, endAnchorRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const translateY = -50 * progress;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[120] w-[min(92vw,520px)] transition-[top,left] duration-150 ease-out"
      style={{
        top,
        left,
        transform: `translate(-50%, ${translateY}%)`,
      }}
      role="dialog"
      aria-modal="false"
      aria-label="Low FDV warning"
    >
      <div className="fud-float-inner relative flex items-start justify-center gap-3 sm:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fud-popup.png"
          alt=""
          className="fud-figure h-[240px] w-auto max-w-[200px] shrink-0 object-contain object-bottom sm:h-[300px] sm:max-w-[250px]"
          draggable={false}
        />

        <div className="pointer-events-auto relative mt-6 max-w-[280px] rounded-2xl border border-[rgba(198,182,186,0.22)] bg-[rgba(27,26,20,0.88)] px-5 py-4 shadow-xl backdrop-blur-sm sm:mt-10">
          <div
            className="absolute -left-2 top-12 hidden h-3 w-3 rotate-45 border-b border-l border-[rgba(198,182,186,0.22)] bg-[rgba(27,26,20,0.88)] sm:block"
            aria-hidden="true"
          />
          <p className="text-[1.75rem] leading-snug text-text-primary">
            are you fudding me here, son? Delete it now
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute -right-2 -top-2 rounded-full border border-[rgba(198,182,186,0.2)] bg-[rgba(27,26,20,0.95)] p-1.5 text-text-secondary transition hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function NumericInput({
  value,
  onChange,
  className,
  step,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  step?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  return (
    <input
      type="number"
      value={draft}
      step={step}
      max={max}
      disabled={disabled}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        if (draft.trim() === "") {
          setDraft("0");
          onChange(0);
        }
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next.trim() === "") {
          return;
        }
        const parsed = Number(next);
        if (!Number.isFinite(parsed)) {
          return;
        }
        if (typeof max === "number") {
          onChange(Math.min(parsed, max));
          return;
        }
        onChange(parsed);
      }}
      className={className}
    />
  );
}

function ResultBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded border border-[rgba(198,182,186,0.08)] bg-bulk-base p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>
        {value}
      </p>
    </div>
  );
}
