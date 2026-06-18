"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { Check, Copy } from "lucide-react";
import { toPng } from "html-to-image";
import { cn } from "@/lib/utils";

interface CopyCardPngButtonProps {
  exportRef: RefObject<HTMLElement | null>;
  filename: string;
  className?: string;
}

export function CopyCardPngButton({ exportRef, filename, className }: CopyCardPngButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [copying, setCopying] = useState(false);

  async function copyPng() {
    if (!exportRef.current || copying) return;

    setCopying(true);
    setCopyError(false);

    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: "#1b1a14",
        cacheBust: true,
        skipFonts: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 2500);
    } finally {
      setCopying(false);
    }
  }

  const label = copied ? "Copied!" : copyError ? "Copy failed" : "Copy PNG";

  return (
    <button
      type="button"
      onClick={copyPng}
      disabled={copying}
      className={cn(
        "btn-ghost inline-flex shrink-0 items-center gap-1.5 !px-2 !py-1 text-[11px] text-text-secondary hover:text-text-primary",
        className
      )}
      title={`Copy ${filename} as PNG`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-bid-green" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function ToolExportSurface({
  exportRef,
  width,
  children,
}: {
  exportRef: RefObject<HTMLDivElement | null>;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-100" aria-hidden="true">
      <div ref={exportRef} className="card p-4 md:p-5" style={{ width }}>
        {children}
      </div>
    </div>
  );
}

function ExportField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-text-secondary">{label}</p>
      <p className="rounded border border-[rgba(198,182,186,0.15)] bg-bulk-base px-3 py-2 font-mono text-sm tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}

export { ToolExportSurface, ExportField };
