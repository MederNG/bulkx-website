import { cn } from "@/lib/utils";

/** Tiny wide uppercase eyebrow — Familjen 9.5px / 600 / 0.17em. */
export function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-label m-0 truncate text-text-muted">{children}</p>
  );
}

/**
 * Premium black Overview panels — same base as the page. Edge via a soft
 * top catch-light only; sides stay almost invisible.
 */
export function PanelCard({
  className,
  glossy,
  glossDelay = 0,
  children,
}: {
  className?: string;
  /** Soft highlight that drifts slowly across the card on its own. */
  glossy?: boolean;
  /** Negative seconds offset so panels drift out of sync with each other. */
  glossDelay?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-[12px] border-0 bg-[var(--color-bulk-base)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:px-5 sm:py-4",
        glossy && "relative overflow-hidden",
        className
      )}
    >
      {glossy && (
        <div
          aria-hidden="true"
          className="gloss-drift pointer-events-none"
          style={{
            animationDelay: `${glossDelay}s, ${glossDelay - 5}s, ${glossDelay - 3}s`,
          }}
        />
      )}
      {glossy ? <div className="relative flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </div>
  );
}
