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
            aria-hidden="true"
            // -inset matches the card's padding so the word is centred in the
            // full panel, not the inner content box. Overflow stays on the
            // card: a clip on this overlay sat inside the padding and cut
            // TOOLS / AURA through the middle of the letters.
            className="pointer-events-none absolute -inset-x-3 -inset-y-8 flex items-center justify-center sm:-inset-x-5"
          >
            <span
              className={cn(
                "whitespace-nowrap font-semibold uppercase tracking-[0.02em]",
                // Same clamp as production: half again the previous mark,
                // faint enough that the bigger shape stays texture, not a
                // second headline.
                "text-[clamp(108px,22.5vw,285px)] text-[rgba(255,181,71,0.05)]"
              )}
              // Inline, not utilities: tailwind-merge drops `leading-none`
              // next to an arbitrary text-[…] size, and the 1.5 body leading
              // would throw vertical centring out by half a line.
              // Negative margin cancels the trailing letter-spacing so the
              // glyph box, not the empty space after the last letter, is
              // what gets centered.
              style={{ lineHeight: 1, marginRight: "-0.02em" }}
            >
              {eyebrow}
            </span>
          </span>
          {/* Fluid rather than a flat 44: at the top of the range this is the
              largest solid type on the site, and a fixed size that reads as a
              page title at 1600 overruns a 1024 one. Uppercase, so the
              tracking goes positive — the negative fit that suits mixed case
              jams capitals together. */}
          <h1 className="relative m-0 text-center text-[clamp(32px,3.2vw,44px)] font-semibold uppercase leading-tight tracking-[0.01em] text-text-primary">
            {title}
          </h1>
          {/* Tab strip only when the page actually has switches (Tools /
              Leaderboards). An empty reserve left Aura / Trade with a dead
              band under the title and made those headers look inflated. */}
          {children ? (
            <div className="relative mt-7 -mb-8 flex min-h-[30px] items-end justify-center">
              {children}
            </div>
          ) : null}
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
