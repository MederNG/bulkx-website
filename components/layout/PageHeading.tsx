import { cn } from "@/lib/utils";
import { PanelCard } from "@/components/overview/PanelCard";

/** Eyebrow + title + description block that opens every section page. */
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  centered,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Centres the block, sets the title larger, and turns the eyebrow into a
   * watermark behind it. Opt-in rather than the default: the other section
   * pages open with a heading pinned left above left-aligned content, and
   * centring one of them alone would only look like a mistake. */
  centered?: boolean;
  /** Rendered inside the card, under the title — for a control that belongs
   * to the heading rather than to the content below it, such as the tabs
   * choosing which tool the page is showing. Centred layouts only. */
  children?: React.ReactNode;
}) {
  if (centered) {
    // No bottom margin on the wrapper: this card sits in a flex column that
    // already sets the gap between blocks, and a margin stacked on top of that
    // made the space under the heading wider than the one between the cards
    // below it.
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        {/* The same shell every panel on the site uses — PanelCard, not a
            hand-rolled box: one border colour, one radius, one background, and
            the drifting highlight already clipped to the card by its own
            overflow. Built by hand this block ended up with a gloss layer
            whose edges showed as seams the other cards do not have.

            The watermark is clipped by the card too, which is the trade: it no
            longer bleeds under the nav, and in exchange the block's edges are
            as clean as its neighbours'. */}
        <PanelCard glossy glossDelay={-16} className="w-full py-8 sm:py-8 text-center">
          <span
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none",
              "text-center font-semibold uppercase tracking-[0.02em]",
              // Half again the size it was, and fainter with it: the bigger a
              // shape gets the more of the eye it takes at the same opacity,
              // so growing it without thinning it would have turned a texture
              // into a second headline. 5% against this near-black card is
              // enough to shape the letters and no more.
              "text-[clamp(108px,22.5vw,285px)] text-[rgba(255,181,71,0.05)]"
            )}
            // Inline, not `leading-none`: tailwind-merge drops a leading
            // utility standing next to an arbitrary text-[…] size, and the
            // word silently inherits the 1.5 body leading, which throws the
            // vertical centring out by half a line.
            style={{ lineHeight: 1 }}
          >
            {eyebrow}
          </span>
          {/* Fluid rather than a flat 44: at the top of the range this is the
              largest solid type on the site, and a fixed size that reads as a
              page title at 1600 overruns a 1024 one. Uppercase, so the
              tracking goes positive — the negative fit that suits mixed case
              jams capitals together. */}
          <h1 className="relative m-0 text-center text-[clamp(32px,3.2vw,44px)] font-semibold uppercase leading-tight tracking-[0.01em] text-text-primary">
            {title}
          </h1>
          {/* Always reserve the tab strip, even on pages that have none.
              Tools and Leaderboards put their switches here; Aura sources
              and Trade left the slot out, so those cards sat shorter and
              clipped the watermark differently. 30px is 13px type at body
              leading plus the tabs' pb-2.5.

              -mb-8 cancels the card's own bottom padding (py-8 / sm:py-8 —
              both, because PanelCard's default sm:py-4 would otherwise win
              on desktop and pull the 2px underline outside overflow-hidden)
              so the tabs sit ON its bottom edge. */}
          <div className="relative mt-7 -mb-8 flex min-h-[30px] items-end justify-center">
            {children}
          </div>
        </PanelCard>
        {description && (
          <p className="mx-auto max-w-[640px] text-sm leading-relaxed text-text-muted">
            {description}
          </p>
        )}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        <h1 className="m-0 mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
