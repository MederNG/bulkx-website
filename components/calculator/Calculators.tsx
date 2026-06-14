"use client";

import { useEffect, useMemo, useState } from "react";
import type { RankTargets } from "@/types";
import { FDV_SCENARIOS, formatNumber, formatUsd } from "@/lib/utils";
import { computeFdv } from "@/lib/percentiles";
import { Select } from "@/components/ui/Select";

interface RankCalculatorProps {
  targets: RankTargets;
}

export function RankCalculator({ targets }: RankCalculatorProps) {
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

  return (
    <div className="card p-4 md:p-5">
      <p className="section-title mb-4">Rank Target Calculator</p>
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
}: FdvEstimatorProps) {

  const result = useMemo(
    () => computeFdv(userAura, fdv, allocation, auraSupply),
    [userAura, fdv, allocation, auraSupply]
  );

  return (
    <div className="card p-4 md:p-5">
      <p className="section-title mb-4">FDV Estimator</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Your Aura" value={userAura} onChange={setUserAura} />
        <Field label="FDV ($)" value={fdv} onChange={setFdv} step={1_000_000} />
        <Field label="Allocation (%)" value={allocation} onChange={setAllocation} max={100} />
        <Field label="Total Aura Supply" value={auraSupply} onChange={setAuraSupply} step={100_000} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ResultBox label="Pool Value" value={formatUsd(result.poolValue)} />
        <ResultBox label="Aura Value" value={`$${result.auraValue.toFixed(4)}`} />
        <ResultBox label="Your Value" value={formatUsd(result.userValue)} accent />
      </div>
    </div>
  );
}

export function FdvTools({ totalAuraSupply }: { totalAuraSupply: number }) {
  const [userAura, setUserAura] = useState(500);
  const [fdv, setFdv] = useState(500_000_000);
  const [allocation, setAllocation] = useState(30);
  const [auraSupply, setAuraSupply] = useState(Math.round(totalAuraSupply));

  return (
    <>
      <FdvEstimator
        userAura={userAura}
        setUserAura={setUserAura}
        fdv={fdv}
        setFdv={setFdv}
        allocation={allocation}
        setAllocation={setAllocation}
        auraSupply={auraSupply}
        setAuraSupply={setAuraSupply}
      />
      <div className="mt-4">
        <FdvMatrix userAura={userAura} allocation={allocation} totalAuraSupply={auraSupply} />
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
  const rows = FDV_SCENARIOS.map((fdv) => {
    const { userValue, auraValue } = computeFdv(userAura, fdv, allocation, totalAuraSupply);
    return {
      fdv: `$${(fdv / 1e6).toFixed(0)}M`,
      auraValue: `$${auraValue.toFixed(4)}`,
      userValue: formatUsd(userValue),
    };
  });

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[rgba(198,182,186,0.1)] p-4">
        <p className="section-title">FDV Scenario Matrix</p>
        <p className="mt-1 text-xs text-text-secondary">
          Based on {userAura.toLocaleString()} Aura · {allocation}% allocation
        </p>
      </div>
      <div className="overflow-x-auto">
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
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">
                  {row.userValue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
