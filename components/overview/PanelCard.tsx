import { cn } from "@/lib/utils";

/** Small uppercase eyebrow label, shared across EVERY panel header on the
 * Overview page — including the KPI strip cards, which used to carry their
 * own separately-tuned label (10.5px against this one's 11px) that made
 * those four titles read at a subtly different size and weight from the
 * panels below them. One component, so that can't drift again. */
export function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 truncate text-[11px] uppercase tracking-[0.11em] text-text-muted">
      {children}
    </p>
  );
}

/**
 * Uniform dark card shell for the four Overview panels — fixed in the grid,
 * not the rotating hero/side-card system the page used before.
 */
export function PanelCard({
  className,
  glossy,
  glossDelay = 0,
  children,
}: {
  className?: string;
  /** Adds a soft highlight that drifts slowly across the card on its own,
   * like a breeze passing over — not tied to the cursor. */
  glossy?: boolean;
  /** Negative seconds offset so panels drift out of sync with each other
   * instead of moving in unison. */
  glossDelay?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-[10px] border border-[var(--color-line)] bg-[var(--color-bulk-base)] px-5 py-4",
        glossy && "relative overflow-hidden",
        className
      )}
    >
      {glossy && (
        <div
          aria-hidden="true"
          className="gloss-drift pointer-events-none"
          style={{
            animationDelay: `${glossDelay}s, ${glossDelay - 5}s, ${glossDelay - 9}s, ${glossDelay - 3}s`,
          }}
        />
      )}
      {glossy ? <div className="relative flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </div>
  );
}
