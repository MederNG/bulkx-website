"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RankTargets } from "@/types";
import { FDV_SCENARIOS, cn, formatNumber, formatUsd } from "@/lib/utils";
import { computeFdv } from "@/lib/percentiles";
import {
  predictDepositAura,
  type DepositAuraPredictContext,
  type DepositPredictMode,
} from "@/lib/deposit-aura-predict";
import { useLiveFinancials } from "@/components/live/LiveFinancialProvider";
import { formatRemainingDuration } from "@/lib/projected-snapshot-tvl";
import { Select } from "@/components/ui/Select";
import { CopyCardPngButton, ExportField, ToolExportSurface } from "@/components/calculator/CopyCardPngButton";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const FDV_FIELD_INFO = {
  yourAura:
    "Total AURA your wallet has earned (or a target amount to model). Use Wallet Lookup or your leaderboard total.",
  fdv: "Fully Diluted Valuation — token price × fully diluted supply (as if all tokens were unlocked). Not market cap, which uses circulating supply only. Enter your scenario in M (millions) or B (billions).",
  allocation:
    "Portion of the total token supply allocated to the airdrop in your scenario.",
  totalSupply:
    "Total AURA counted for the pool — usually the campaign-wide total across all wallets. Defaults to the live total on this site.",
  poolValue:
    "Token Price × Allocation (%) — effective airdrop market cap (Token Price = FDV ÷ 1B). Edit to set a target; FDV, Aura Value, and Your Value update.",
  auraValue:
    "Effective Market Cap ÷ Total Aura Supply — USD per AURA. Edit to set a price; Effective Market Cap, FDV, and Your Value update.",
  yourValue:
    "Your Aura × Aura Value — your estimated payout. Edit to set a target; Aura Value, Effective Market Cap, and FDV update.",
} as const;

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
    <div className="min-w-0 lg:row-span-3">
      <div className="card tool-pair-card flex h-full flex-col gap-5 overflow-visible p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="section-title">Rank Target Calculator</p>
          <CopyCardPngButton exportRef={exportRef} filename="rank-target-calculator" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">Current Aura</label>
            <NumericInput value={currentAura} onChange={setCurrentAura} className="input-field font-mono tabular-nums" />
            <p className="invisible mt-1 text-[10px] text-text-secondary" aria-hidden="true">
              spacer
            </p>
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
        <div className="mt-auto grid gap-4 sm:grid-cols-2">
          <div>
            <ResultBox label="Required Aura" value={formatNumber(required)} />
            <p className="invisible mt-1 text-[10px] text-text-secondary" aria-hidden="true">
              spacer
            </p>
          </div>
          <ResultBox label="Additional Aura Needed" value={formatNumber(additional)} accent={additional > 0} />
        </div>
      </div>
      <ToolExportSurface exportRef={exportRef} width={560}>
        <p className="section-title mb-4">Rank Target Calculator</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ExportField label="Current Aura" value={formatNumber(currentAura)} />
          <ExportField label="Target" value={targetLabel} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ResultBox label="Required Aura" value={formatNumber(required)} />
          <ResultBox label="Additional Aura Needed" value={formatNumber(additional)} accent={additional > 0} />
        </div>
      </ToolExportSurface>
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
  const exportRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () => computeFdv(userAura, fdv, allocation, auraSupply),
    [userAura, fdv, allocation, auraSupply]
  );
  const fdvLabel = fdv >= 1_000_000_000
    ? `${(fdv / 1_000_000_000).toFixed(fdv % 1_000_000_000 === 0 ? 0 : 1)}B`
    : `${Math.round(fdv / 1_000_000)}M`;

  const applyFdvFromDerived = (nextFdv: number) => {
    const safe = Number.isFinite(nextFdv) && nextFdv >= 0 ? nextFdv : 0;
    setFdv(safe);
  };

  const setMarketCap = (marketCap: number) => {
    if (allocation <= 0) return;
    applyFdvFromDerived(marketCap / (allocation / 100));
  };

  const setAuraValue = (auraValue: number) => {
    if (auraSupply <= 0 || allocation <= 0) return;
    applyFdvFromDerived((auraValue * auraSupply) / (allocation / 100));
  };

  const setYourValue = (yourValue: number) => {
    if (userAura <= 0 || auraSupply <= 0 || allocation <= 0) return;
    const auraValue = yourValue / userAura;
    applyFdvFromDerived((auraValue * auraSupply) / (allocation / 100));
  };

  return (
    <div className="min-w-0 lg:row-span-3">
      <div className="card tool-pair-card flex h-full flex-col gap-5 overflow-visible p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="section-title">FDV Estimator</p>
          <CopyCardPngButton exportRef={exportRef} filename="fdv-estimator" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_minmax(13.5rem,1.4fr)_1fr_1.15fr]">
          <Field
            label="Your Aura"
            info={FDV_FIELD_INFO.yourAura}
            value={userAura}
            onChange={setUserAura}
          />
          <FdvField fdv={fdv} onFdvChange={setFdv} info={FDV_FIELD_INFO.fdv} />
          <Field
            label="Allocation (%)"
            info={FDV_FIELD_INFO.allocation}
            value={allocation}
            onChange={setAllocation}
            max={100}
          />
          <Field
            label="Total Aura Supply"
            info={FDV_FIELD_INFO.totalSupply}
            value={auraSupply}
            onChange={setAuraSupply}
            step={100_000}
          />
        </div>
        <div className="mt-auto grid gap-4 sm:grid-cols-3">
          <EditableMoneyBox
            label="Effective Market Cap"
            info={FDV_FIELD_INFO.poolValue}
            value={result.poolValue}
            onChange={setMarketCap}
          />
          <EditableAuraValueBox
            label="Aura Value"
            info={FDV_FIELD_INFO.auraValue}
            value={result.auraValue}
            onChange={setAuraValue}
          />
          <EditableDollarBox
            label="Your Value"
            info={FDV_FIELD_INFO.yourValue}
            value={result.userValue}
            onChange={setYourValue}
            accent
          />
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
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <ResultBox label="Effective Market Cap" value={formatUsd(result.poolValue)} />
          <ResultBox label="Aura Value" value={`$${result.auraValue.toFixed(4)}`} />
          <ResultBox label="Your Value" value={formatUsd(result.userValue)} accent />
        </div>
      </ToolExportSurface>
    </div>
  );
}

export function CalculatorSection({
  targets,
  totalAuraSupply,
}: {
  targets: RankTargets;
  totalAuraSupply: number;
}) {
  const { depositPredict } = useLiveFinancials();
  const [userAura, setUserAura] = useState(500);
  const [fdv, setFdv] = useState(500_000_000);
  const [allocation, setAllocation] = useState(30);
  const [auraSupply, setAuraSupply] = useState(Math.round(totalAuraSupply));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
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
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <FdvMatrix userAura={userAura} allocation={allocation} totalAuraSupply={auraSupply} />
        <DepositAuraPredictor context={depositPredict} />
      </div>
    </div>
  );
}

function formatUsdHours(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

export function DepositAuraPredictor({
  context,
}: {
  context: DepositAuraPredictContext;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [deposit, setDeposit] = useState(1_000);
  const [mode, setMode] = useState<DepositPredictMode | null>("new_deposit");
  const [holdSinceWeek, setHoldSinceWeek] = useState<number | null>(null);

  const result = useMemo(
    () =>
      predictDepositAura(
        deposit,
        {
          depositPool: context.depositPool,
          cohortUsdHoursAtSnapshot: context.cohortUsdHoursAtSnapshot,
          hoursUntilSnapshot: context.hoursUntilSnapshot,
          hoursInWeek: context.hoursInWeek,
          campaignWeek: context.campaignWeek,
          weekTvl: context.weekTvl,
        },
        {
          mode: mode ?? undefined,
          holdSinceWeek,
        }
      ),
    [deposit, context, mode, holdSinceWeek]
  );

  const holdSinceActive = holdSinceWeek != null;
  const effectiveFullWeek = holdSinceActive || mode === "full_week_hold";

  const timeUntilSnapshot = formatRemainingDuration(context.hoursUntilSnapshot * 3_600_000);
  const scenarioLabel = holdSinceActive
    ? `Hold since Week ${holdSinceWeek} · Weeks ${holdSinceWeek}–${context.campaignWeek}`
    : mode === "full_week_hold"
      ? "Full week hold"
      : "Deposit now";

  const holdSinceOptions = Array.from({ length: context.campaignWeek }, (_, i) => i + 1);

  return (
    <div className="min-w-0 h-full">
      <div className="card flex h-full flex-col">
        <div className="flex min-h-[5.25rem] items-start justify-between gap-3 border-b border-[rgba(198,182,186,0.1)] p-4">
          <div>
            <p className="section-title">Aura Predictor</p>
            <p className="mt-1 text-xs text-text-secondary">Week {context.campaignWeek}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-text-secondary">
              {context.currentWeekWindow}
            </p>
          </div>
          <CopyCardPngButton exportRef={exportRef} filename="aura-predictor" />
        </div>

        <div className="flex flex-1 flex-col p-4 md:p-5">
        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-text-secondary">Hold scenario</label>
          <SegmentToggle
            value={holdSinceActive ? "" : mode ?? "new_deposit"}
            onChange={(v) => {
              if (!v) return;
              setHoldSinceWeek(null);
              setMode(v as DepositPredictMode);
            }}
            options={[
              { value: "new_deposit", label: "Deposit now" },
              { value: "full_week_hold", label: "Full week hold" },
            ]}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-text-secondary">Hold since</label>
          <SegmentToggle
            value={holdSinceWeek != null ? String(holdSinceWeek) : ""}
            onChange={(v) => {
              if (v) {
                setMode(null);
                setHoldSinceWeek(Number(v));
                return;
              }
              setHoldSinceWeek(null);
              setMode("new_deposit");
            }}
            allowDeselect
            options={holdSinceOptions.map((week) => ({
              value: String(week),
              label: `Week ${week}`,
            }))}
          />
          <p className="mt-1.5 text-[10px] leading-relaxed text-text-secondary">
            {holdSinceActive
              ? `Total Aura if you held ${formatUsd(deposit)} without interruption from Week ${holdSinceWeek} through Week ${context.campaignWeek} · Week ${context.campaignWeek} in progress (${timeUntilSnapshot} to snapshot)`
              : "Optional · cumulative Aura if you never stopped holding from that week"}
          </p>
        </div>

        <Field
          label="Deposit Amount ($)"
          value={deposit}
          onChange={setDeposit}
          step={100}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox
            label={holdSinceActive ? "Predicted Total Aura" : "Predicted Deposit Aura"}
            value={formatNumber(Math.round(result.predictedAura))}
            accent
          />
          <ResultBox label="Efficiency" value={`${result.efficiency.toFixed(4)} A/$`} />
          {!holdSinceActive && (
            <ResultBox label="Pool Share" value={`${result.poolSharePct.toFixed(4)}%`} />
          )}
          <ResultBox
            label={effectiveFullWeek ? "Week USD-Hours" : "Your USD-Hours"}
            value={formatUsdHours(result.userUsdHours)}
          />
        </div>

        {holdSinceActive && result.weekBreakdown && result.weekBreakdown.length > 0 && (
          <div className="mt-4 rounded border border-[rgba(198,182,186,0.08)] bg-bulk-base p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-text-secondary">Per week</p>
            <div className="space-y-1.5">
              {result.weekBreakdown.map((row) => (
                <div key={row.week} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-text-secondary">
                    Week {row.week}
                    {row.inProgress && (
                      <span className="text-[10px] text-text-secondary/80">
                        {" "}
                        · in progress · {timeUntilSnapshot} to snapshot
                      </span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums text-accent">
                    {formatNumber(Math.round(row.aura))} A
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-text-secondary">
          {holdSinceActive ? (
            <>
              Weeks {holdSinceWeek}–{context.campaignWeek} · completed weeks Sat→Sat · Week{" "}
              {context.campaignWeek} ({context.currentWeekWindow}) · {timeUntilSnapshot} left
            </>
          ) : (
            <>
              Snapshot {context.snapshotLabel} · {timeUntilSnapshot} remaining · {scenarioLabel} ·
              Week 1: Jun 1 → first snapshot · Week 2+: Sat 13:00 UTC → Sat 13:00 UTC
            </>
          )}
        </p>
        </div>
      </div>
      <ToolExportSurface exportRef={exportRef} width={560}>
        <p className="section-title mb-1">Aura Predictor</p>
        <p className="mb-4 text-xs text-text-secondary">
          Week {context.campaignWeek} · {scenarioLabel}
        </p>
        <ExportField label="Deposit ($)" value={formatUsd(deposit)} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox
            label={holdSinceActive ? "Predicted Total Aura" : "Predicted Deposit Aura"}
            value={formatNumber(Math.round(result.predictedAura))}
            accent
          />
          <ResultBox label="Efficiency" value={`${result.efficiency.toFixed(4)} A/$`} />
          {!holdSinceActive && (
            <ResultBox label="Pool Share" value={`${result.poolSharePct.toFixed(4)}%`} />
          )}
          <ResultBox label="USD-Hours" value={formatUsdHours(result.userUsdHours)} />
        </div>
        {holdSinceActive && result.weekBreakdown && result.weekBreakdown.length > 0 && (
          <div className="mt-4 space-y-1">
            {result.weekBreakdown.map((row) => (
              <div key={row.week} className="flex justify-between text-xs">
                <span>Week {row.week}</span>
                <span className="font-mono">{formatNumber(Math.round(row.aura))} A</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-[10px] text-text-secondary">
          {holdSinceActive
            ? `Weeks ${holdSinceWeek}–${context.campaignWeek} · uninterrupted hold`
            : `${context.snapshotLabel} · hold until snapshot`}
        </p>
      </ToolExportSurface>
    </div>
  );
}

function SegmentToggle({
  value,
  onChange,
  options,
  disabled,
  allowDeselect,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  allowDeselect?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex rounded-md border border-[rgba(198,182,186,0.15)] bg-bulk-base p-0.5",
        disabled && "pointer-events-none opacity-45"
      )}
    >
      {options.map(({ value: optionValue, label }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (allowDeselect && selected) {
                onChange("");
                return;
              }
              onChange(optionValue);
            }}
            aria-pressed={selected}
            className={cn(
              "min-w-0 flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              selected
                ? "bg-[rgba(255,181,71,0.14)] text-accent"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
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
    <div className="min-w-0 h-full">
      <div className="card flex h-full flex-col">
        <div className="flex min-h-[5.25rem] items-start justify-between gap-3 border-b border-[rgba(198,182,186,0.1)] p-4">
          <div>
            <p className="section-title">FDV Scenario Matrix</p>
            <p className="mt-1 text-xs text-text-secondary">
              Based on {userAura.toLocaleString()} Aura
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-text-secondary">
              {allocation}% allocation · scenario payouts by FDV
            </p>
          </div>
          <CopyCardPngButton exportRef={exportRef} filename="fdv-scenario-matrix" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <FdvMatrixTable rows={rows} fill />
        </div>
      </div>
      <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-100" aria-hidden="true">
        <div ref={exportRef} className="card" style={{ width: 520 }}>
          <div className="border-b border-[rgba(198,182,186,0.1)] p-4">
            <p className="section-title">FDV Scenario Matrix</p>
            <p className="mt-1 text-xs text-text-secondary">
              Based on {userAura.toLocaleString()} Aura
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-text-secondary">
              {allocation}% allocation · scenario payouts by FDV
            </p>
          </div>
          <FdvMatrixTable rows={rows} />
        </div>
      </div>
    </div>
  );
}

function FdvMatrixTable({
  rows,
  fill = false,
}: {
  rows: { fdv: string; auraValue: string; userValue: string }[];
  fill?: boolean;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col", fill && "h-full flex-1")}>
      <div className="grid grid-cols-3 border-b border-[rgba(198,182,186,0.1)] px-4 py-3 text-xs text-text-secondary">
        <span className="font-medium">FDV</span>
        <span className="text-right font-medium">Aura Value</span>
        <span className="text-right font-medium">Your Value</span>
      </div>
      <div className={cn("flex min-h-0 flex-col", fill && "flex-1")}>
        {rows.map((row) => (
          <div
            key={row.fdv}
            className={cn(
              "grid grid-cols-3 items-center border-b border-[rgba(198,182,186,0.05)] px-4 text-xs",
              fill ? "flex-1 py-2" : "py-2.5"
            )}
          >
            <span className="font-mono font-medium">{row.fdv}</span>
            <span className="text-right font-mono tabular-nums">{row.auraValue}</span>
            <span className="text-right font-mono tabular-nums text-accent">{row.userValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ label, info }: { label: string; info?: string }) {
  return (
    <span className="mb-1 flex items-center gap-1.5">
      <span className="text-xs text-text-secondary">{label}</span>
      {info ? <InfoTooltip text={info} floating panelClassName="w-64" /> : null}
    </span>
  );
}

function Field({
  label,
  info,
  value,
  onChange,
  step,
  max,
  disabled,
}: {
  label: string;
  info?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel label={label} info={info} />
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

function formatCommaNumber(value: number, maxFractionDigits = 0): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatCommaInput(raw: string, maxFractionDigits = 6): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return cleaned;

  const [intPart = "", decPart] = cleaned.split(".");
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  const withCommas = normalizedInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (cleaned.includes(".")) {
    return `${withCommas}.${(decPart ?? "").slice(0, maxFractionDigits)}`;
  }
  return withCommas;
}

function parseCommaNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function restoreCommaCursor(el: HTMLInputElement, formatted: string, digitsBefore: number) {
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < digitsBefore) {
    if (/[\d.]/.test(formatted[pos]!)) seen += 1;
    pos += 1;
  }
  el.setSelectionRange(pos, pos);
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatFdvUnitDisplay(unitValue: number): string {
  return formatCommaNumber(Math.max(0, roundToHundredths(unitValue)), 2);
}

function formatFdvDisplay(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return formatCommaNumber(rounded, 3);
}

function resolveFdvUnit(absoluteFdv: number): FdvUnit {
  return absoluteFdv >= 1_000_000_000 ? "B" : "M";
}

function FdvField({
  fdv,
  onFdvChange,
  info,
}: {
  fdv: number;
  onFdvChange: (v: number) => void;
  info?: string;
}) {
  const [unit, setUnit] = useState<FdvUnit>(() => resolveFdvUnit(fdv));
  const [draft, setDraft] = useState(() =>
    formatFdvUnitDisplay(fdv / FDV_UNIT_MULTIPLIER[resolveFdvUnit(fdv)])
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused) return;
    const nextUnit = resolveFdvUnit(fdv);
    setUnit(nextUnit);
    setDraft(formatFdvUnitDisplay(fdv / FDV_UNIT_MULTIPLIER[nextUnit]));
  }, [fdv, isFocused]);

  const applyAbsoluteFdv = (absolute: number, syncDraft = true) => {
    const safe = Math.max(0, absolute);
    const nextUnit = resolveFdvUnit(safe);
    const unitValue = roundToHundredths(safe / FDV_UNIT_MULTIPLIER[nextUnit]);
    const snapped = unitValue * FDV_UNIT_MULTIPLIER[nextUnit];
    setUnit(nextUnit);
    if (syncDraft) setDraft(formatFdvUnitDisplay(unitValue));
    onFdvChange(snapped);
    return { nextUnit, unitValue, snapped };
  };

  const commitDraft = (nextDraft: string, nextUnit: FdvUnit = unit) => {
    const trimmed = nextDraft.trim();
    if (trimmed === "" || trimmed === ".") {
      applyAbsoluteFdv(0);
      return;
    }
    const parsed = parseCommaNumber(trimmed);
    if (parsed == null) return;
    applyAbsoluteFdv(roundToHundredths(parsed) * FDV_UNIT_MULTIPLIER[nextUnit]);
  };

  const selectUnit = (nextUnit: FdvUnit) => {
    if (nextUnit === unit) return;
    if (isFocused && draft.trim() !== "") {
      commitDraft(draft, nextUnit);
      return;
    }
    setUnit(nextUnit);
    setDraft(formatFdvUnitDisplay(fdv / FDV_UNIT_MULTIPLIER[nextUnit]));
  };

  return (
    <div className="relative min-w-[13.5rem]">
      <FieldLabel label="FDV ($)" info={info} />
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "" || draft.trim() === ".") {
              applyAbsoluteFdv(0);
              return;
            }
            commitDraft(draft);
          }}
          onChange={(e) => {
            const input = e.target;
            const nextRaw = input.value;
            if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

            const cursor = input.selectionStart ?? nextRaw.length;
            const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
            const formatted = formatCommaInput(nextRaw, 2);
            setDraft(formatted);

            const parsed = parseCommaNumber(formatted);
            if (parsed != null) {
              const { nextUnit, unitValue } = applyAbsoluteFdv(
                roundToHundredths(parsed) * FDV_UNIT_MULTIPLIER[unit],
                false
              );
              if (nextUnit !== unit) {
                const display = formatFdvUnitDisplay(unitValue);
                setDraft(display);
                requestAnimationFrame(() => {
                  const el = inputRef.current;
                  if (!el) return;
                  el.setSelectionRange(display.length, display.length);
                });
                return;
              }
            }

            requestAnimationFrame(() => {
              if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
            });
          }}
          className="input-field min-w-[6.75rem] flex-1 font-mono tabular-nums"
        />
        <div className="flex shrink-0 gap-0.5">
          {(["M", "B"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectUnit(key)}
              className={cn(
                "btn-ghost !min-w-[2rem] !px-1.5 !py-0 font-mono text-xs font-semibold",
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
        {unit === "M" ? "Millions USD" : "Billions USD"} · $
        {unit === "B"
          ? `${(fdv / 1_000_000_000).toFixed(2)}B`
          : `${(fdv / 1_000_000).toFixed(2)}M`}
      </p>
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
  const maxFractionDigits =
    typeof step === "number" && step > 0 && step < 1
      ? Math.min(6, Math.ceil(-Math.log10(step)))
      : 0;
  const [draft, setDraft] = useState(() => formatCommaNumber(value, maxFractionDigits));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatCommaNumber(value, maxFractionDigits));
    }
  }, [value, isFocused, maxFractionDigits]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        if (draft.trim() === "" || draft.trim() === ".") {
          setDraft("0");
          onChange(0);
          return;
        }
        const parsed = parseCommaNumber(draft);
        if (parsed == null) return;
        const next = typeof max === "number" ? Math.min(parsed, max) : parsed;
        onChange(next);
        setDraft(formatCommaNumber(next, maxFractionDigits));
      }}
      onChange={(e) => {
        const input = e.target;
        const nextRaw = input.value;
        if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

        const cursor = input.selectionStart ?? nextRaw.length;
        const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
        const formatted = formatCommaInput(nextRaw, Math.max(maxFractionDigits, 6));
        setDraft(formatted);

        const parsed = parseCommaNumber(formatted);
        if (parsed != null) {
          onChange(typeof max === "number" ? Math.min(parsed, max) : parsed);
        }

        requestAnimationFrame(() => {
          if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
        });
      }}
      className={className}
    />
  );
}

function pickUsdUnit(value: number): FdvUnit {
  return value >= 1_000_000_000 ? "B" : "M";
}

function EditableMoneyBox({
  label,
  info,
  value,
  onChange,
  accent,
}: {
  label: string;
  info?: string;
  value: number;
  onChange: (v: number) => void;
  accent?: boolean;
}) {
  const [unit, setUnit] = useState<FdvUnit>(() => pickUsdUnit(value));
  const [draft, setDraft] = useState(() =>
    formatFdvDisplay(value / FDV_UNIT_MULTIPLIER[pickUsdUnit(value)])
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused) return;
    const nextUnit = pickUsdUnit(value);
    setUnit(nextUnit);
    setDraft(formatFdvDisplay(value / FDV_UNIT_MULTIPLIER[nextUnit]));
  }, [value, isFocused]);

  const applyValue = (next: number) => {
    if (!Number.isFinite(next) || next < 0) return;
    onChange(next);
  };

  const commitDraft = (nextDraft: string, nextUnit: FdvUnit = unit) => {
    const trimmed = nextDraft.trim();
    if (trimmed === "" || trimmed === ".") {
      applyValue(0);
      return;
    }
    const parsed = parseCommaNumber(trimmed);
    if (parsed == null) return;
    applyValue(parsed * FDV_UNIT_MULTIPLIER[nextUnit]);
  };

  const selectUnit = (nextUnit: FdvUnit) => {
    if (nextUnit === unit) return;
    setUnit(nextUnit);
    if (isFocused && draft.trim() !== "") {
      commitDraft(draft, nextUnit);
      return;
    }
    setDraft(formatFdvDisplay(value / FDV_UNIT_MULTIPLIER[nextUnit]));
  };

  return (
    <div className="relative min-w-0">
      <FieldLabel label={label} info={info} />
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "" || draft.trim() === ".") {
              setDraft("0");
              applyValue(0);
              return;
            }
            commitDraft(draft);
            const parsed = parseCommaNumber(draft);
            if (parsed != null) setDraft(formatFdvDisplay(parsed));
          }}
          onChange={(e) => {
            const input = e.target;
            const nextRaw = input.value;
            if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

            const cursor = input.selectionStart ?? nextRaw.length;
            const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
            const formatted = formatCommaInput(nextRaw, 3);
            setDraft(formatted);

            const parsed = parseCommaNumber(formatted);
            if (parsed != null) applyValue(parsed * FDV_UNIT_MULTIPLIER[unit]);

            requestAnimationFrame(() => {
              if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
            });
          }}
          className={cn(
            "input-field min-w-0 flex-1 font-mono tabular-nums",
            accent && "text-accent"
          )}
        />
        <div className="flex shrink-0 gap-0.5">
          {(["M", "B"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectUnit(key)}
              className={cn(
                "btn-ghost !min-w-[2rem] !px-1.5 !py-0 font-mono text-xs font-semibold",
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
        {unit === "M" ? "Millions USD" : "Billions USD"} · $
        {unit === "B"
          ? `${(value / 1_000_000_000).toFixed(2)}B`
          : `${(value / 1_000_000).toFixed(2)}M`}
      </p>
    </div>
  );
}

function EditableDollarBox({
  label,
  info,
  value,
  onChange,
  accent,
}: {
  label: string;
  info?: string;
  value: number;
  onChange: (v: number) => void;
  accent?: boolean;
}) {
  const [draft, setDraft] = useState(() => formatCommaNumber(value, 2));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatCommaNumber(value, 2));
    }
  }, [value, isFocused]);

  const applyValue = (next: number) => {
    if (!Number.isFinite(next) || next < 0) return;
    onChange(next);
  };

  return (
    <div>
      <FieldLabel label={label} info={info} />
      <div className="relative">
        <span
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm",
            accent ? "text-accent" : "text-text-secondary"
          )}
        >
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "" || draft.trim() === ".") {
              setDraft("0");
              applyValue(0);
              return;
            }
            const parsed = parseCommaNumber(draft);
            if (parsed == null) return;
            applyValue(parsed);
            setDraft(formatCommaNumber(parsed, 2));
          }}
          onChange={(e) => {
            const input = e.target;
            const nextRaw = input.value;
            if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

            const cursor = input.selectionStart ?? nextRaw.length;
            const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
            const formatted = formatCommaInput(nextRaw, 2);
            setDraft(formatted);

            const parsed = parseCommaNumber(formatted);
            if (parsed != null) applyValue(parsed);

            requestAnimationFrame(() => {
              if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
            });
          }}
          className={cn(
            "input-field font-mono tabular-nums !pl-7",
            accent && "text-accent"
          )}
        />
      </div>
    </div>
  );
}

function EditableAuraValueBox({
  label,
  info,
  value,
  onChange,
}: {
  label: string;
  info?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatCommaNumber(value, 4));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatCommaNumber(value, 4));
    }
  }, [value, isFocused]);

  const applyValue = (next: number) => {
    if (!Number.isFinite(next) || next < 0) return;
    onChange(next);
  };

  return (
    <div>
      <FieldLabel label={label} info={info} />
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-secondary">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (draft.trim() === "" || draft.trim() === ".") {
              setDraft("0");
              applyValue(0);
              return;
            }
            const parsed = parseCommaNumber(draft);
            if (parsed == null) return;
            applyValue(parsed);
            setDraft(formatCommaNumber(parsed, 4));
          }}
          onChange={(e) => {
            const input = e.target;
            const nextRaw = input.value;
            if (nextRaw !== "" && !/^[\d,]*\.?\d*$/.test(nextRaw)) return;

            const cursor = input.selectionStart ?? nextRaw.length;
            const digitsBeforeCursor = nextRaw.slice(0, cursor).replace(/[^\d.]/g, "").length;
            const formatted = formatCommaInput(nextRaw, 4);
            setDraft(formatted);

            const parsed = parseCommaNumber(formatted);
            if (parsed != null) applyValue(parsed);

            requestAnimationFrame(() => {
              if (inputRef.current) restoreCommaCursor(inputRef.current, formatted, digitsBeforeCursor);
            });
          }}
          className="input-field font-mono tabular-nums !pl-7"
        />
      </div>
    </div>
  );
}

function ResultBox({
  label,
  value,
  accent,
  info,
}: {
  label: string;
  value: string;
  accent?: boolean;
  info?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} info={info} />
      <div
        className={cn(
          "input-field flex min-h-[2.625rem] items-center font-mono tabular-nums",
          accent && "text-accent"
        )}
      >
        {value}
      </div>
    </div>
  );
}
