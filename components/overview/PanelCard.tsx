import { cn } from "@/lib/utils";

/** Tiny wide uppercase eyebrow — Familjen 9.5px / 600 / 0.17em. */
export function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-label m-0 truncate text-text-muted">{children}</p>
  );
}

/**
 * Overview panels — lifted #121214 cards with a hairline, matching the
 * dashboard layout mockup.
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
        "flex min-h-0 min-w-0 flex-col rounded-[10px] border border-[var(--color-line)] bg-[var(--color-bg-primary)] px-3 py-3 sm:px-5 sm:py-4",
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
