import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, decimals = 0): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatUsd(value: number): string {
  return `$${formatNumber(value, value < 1000 ? 2 : 0)}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function truncateWallet(wallet: string, chars = 4): string {
  if (wallet.length <= chars * 2 + 3) return wallet;
  return `${wallet.slice(0, chars)}...${wallet.slice(-chars)}`;
}

export function categoryLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const AURA_BUCKETS = [
  { label: "0", min: 0, max: 0 },
  { label: "1-10", min: 1, max: 10 },
  { label: "10-50", min: 10, max: 50 },
  { label: "50-100", min: 50, max: 100 },
  { label: "100-250", min: 100, max: 250 },
  { label: "250-500", min: 250, max: 500 },
  { label: "500-1000", min: 500, max: 1000 },
  { label: "1000-2500", min: 1000, max: 2500 },
  { label: "2500-5000", min: 2500, max: 5000 },
  { label: "5000+", min: 5000, max: Infinity },
];

export const FDV_SCENARIOS = [100_000_000, 250_000_000, 500_000_000, 750_000_000, 1_000_000_000, 2_000_000_000];
