"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { toPng } from "html-to-image";
import type { WalletData } from "@/types";
import { formatNumber, truncateWallet } from "@/lib/utils";

const BACKGROUND_OPTIONS = [
  { id: "phoenician", label: "Phoenician", src: "/share-card-backgrounds/phoenician.png" },
  { id: "transsahara", label: "Trans-Sahara", src: "/share-card-backgrounds/transsahara.png" },
  { id: "viking", label: "Viking", src: "/share-card-backgrounds/viking.png" },
  { id: "industrial", label: "Industrial", src: "/share-card-backgrounds/industrial.png" },
  { id: "prehistoric", label: "Prehistoric", src: "/share-card-backgrounds/prehistoric.png" },
  { id: "exchange", label: "Stock Exchange", src: "/share-card-backgrounds/exchange.png" },
] as const;

export function ShareCardGenerator() {
  const [address, setAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<(typeof BACKGROUND_OPTIONS)[number]["id"]>(
    "phoenician"
  );
  const previewCardRef = useRef<HTMLDivElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);
  const selectedBackgroundSrc =
    BACKGROUND_OPTIONS.find((option) => option.id === selectedBackground)?.src ??
    BACKGROUND_OPTIONS[0].src;

  async function loadWallet() {
    if (!address.trim()) return;
    setBgLoaded(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet?address=${encodeURIComponent(address.trim())}`);
      if (res.ok) setWallet(await res.json());
      else setWallet(null);
    } finally {
      setLoading(false);
    }
  }

  async function renderCardPng() {
    if (!exportCardRef.current || !bgLoaded) return null;
    return toPng(exportCardRef.current, {
      pixelRatio: 2,
      backgroundColor: "#0A0C11",
      cacheBust: true,
      skipFonts: true,
    });
  }

  async function exportPng() {
    const dataUrl = await renderCardPng();
    if (!dataUrl) return;
    const link = document.createElement("a");
    const safeName = (displayName.trim() || wallet?.wallet.slice(0, 8) || "card")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");
    link.download = `bulk-intelligence-${safeName}.png`;
    link.href = dataUrl;
    link.click();
  }

  async function copyPng() {
    const dataUrl = await renderCardPng();
    if (!dataUrl) return;

    setCopyError(false);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 2500);
    }
  }

  return (
    <div className="card p-4 md:p-5">
      <p className="section-title mb-4">Share Card Generator</p>
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Wallet address..."
          className="input-field font-mono text-sm"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name on card..."
          className="input-field text-sm"
        />
        <button onClick={loadWallet} className="btn-primary shrink-0" disabled={loading}>
          Generate
        </button>
      </div>
      <div className="mb-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-text-secondary">Card Background Library</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {BACKGROUND_OPTIONS.map((option) => {
            const active = option.id === selectedBackground;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSelectedBackground(option.id);
                  setBgLoaded(false);
                }}
                className={`overflow-hidden rounded border text-left transition ${
                  active
                    ? "border-[rgba(255,181,71,0.8)] ring-1 ring-[rgba(255,181,71,0.5)]"
                    : "border-[rgba(198,182,186,0.2)] hover:border-[rgba(255,181,71,0.5)]"
                }`}
              >
                <img
                  src={option.src}
                  alt={option.label}
                  className="h-14 w-full object-cover"
                  crossOrigin="anonymous"
                />
                <span className="block px-2 py-1 text-[10px] text-text-secondary">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {wallet && (
        <>
          <div className="flex justify-center">
            <div
              ref={previewCardRef}
              className="relative mx-auto overflow-hidden rounded border border-[rgba(255,181,71,0.35)]"
              style={{
                width: 640,
                height: 360,
                background: "#050912",
              }}
            >
              <img
                src={selectedBackgroundSrc}
                alt=""
                crossOrigin="anonymous"
                className="absolute inset-0 h-full w-full object-contain"
                onLoad={() => setBgLoaded(true)}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 12% 88%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0.08) 52%, rgba(0,0,0,0.14) 100%), linear-gradient(160deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.06) 45%, rgba(0,0,0,0.12) 100%)",
                }}
              />
              <div className="relative z-10 flex h-full flex-col p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.2em] text-accent">BULK INTELLIGENCE</span>
                </div>
                <p className="text-lg font-semibold text-text-primary">
                  {displayName.trim() || truncateWallet(wallet.wallet, 8)}
                </p>
                <div className="mt-8 flex justify-between">
                  <div className="w-[190px] space-y-5">
                    <CardStat label="Aura" value={formatNumber(wallet.aura)} highlight />
                    <CardStat
                      label="Efficiency"
                      value={wallet.efficiency.toFixed(3)}
                      unit="AURA/USDC"
                    />
                  </div>
                  <div className="w-[210px] space-y-5 text-right">
                    <CardStat label="Aura Rank" value={`#${wallet.aura_rank}`} />
                    <CardStat label="Percentile" value={`Top ${(100 - wallet.percentile).toFixed(1)}%`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Offscreen export node: isolated from layout/scroll clipping */}
          <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-100">
            <div
              ref={exportCardRef}
              className="relative overflow-hidden rounded border border-[rgba(255,181,71,0.35)]"
              style={{
                width: 640,
                height: 360,
                background: "#050912",
              }}
            >
              <img
                src={selectedBackgroundSrc}
                alt=""
                crossOrigin="anonymous"
                className="absolute inset-0 h-full w-full object-contain"
                onLoad={() => setBgLoaded(true)}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 12% 88%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0.08) 52%, rgba(0,0,0,0.14) 100%), linear-gradient(160deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.06) 45%, rgba(0,0,0,0.12) 100%)",
                }}
              />
              <div className="relative z-10 flex h-full flex-col p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.2em] text-accent">BULK INTELLIGENCE</span>
                </div>
                <p className="text-lg font-semibold text-text-primary">
                  {displayName.trim() || truncateWallet(wallet.wallet, 8)}
                </p>
                <div className="mt-8 flex justify-between">
                  <div className="w-[190px] space-y-5">
                    <CardStat label="Aura" value={formatNumber(wallet.aura)} highlight />
                    <CardStat
                      label="Efficiency"
                      value={wallet.efficiency.toFixed(3)}
                      unit="AURA/USDC"
                    />
                  </div>
                  <div className="w-[210px] space-y-5 text-right">
                    <CardStat label="Aura Rank" value={`#${wallet.aura_rank}`} />
                    <CardStat label="Percentile" value={`Top ${(100 - wallet.percentile).toFixed(1)}%`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={exportPng}
              className="btn-primary flex items-center gap-2"
              disabled={!bgLoaded}
              title={!bgLoaded ? "Background is still loading..." : undefined}
            >
              <Download className="h-4 w-4" />
              Export PNG
            </button>
            <button
              onClick={copyPng}
              className="btn-ghost flex items-center gap-2 border border-[rgba(198,182,186,0.2)]"
              disabled={!bgLoaded}
              title={!bgLoaded ? "Background is still loading..." : undefined}
            >
              {copied ? <Check className="h-4 w-4 text-bid-green" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : copyError ? "Copy failed" : "Copy PNG"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CardStat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgba(255,254,239,0.75)]">{label}</p>
      <p
        className={`mt-1 font-mono text-[28px] font-semibold leading-none tabular-nums ${highlight ? "text-accent" : "text-text-primary"}`}
      >
        {value}
        {unit ? (
          <span className="ml-1.5 align-baseline text-[11px] font-sans font-medium tracking-wide text-[rgba(255,254,239,0.65)]">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}
