import { cn } from "@/lib/utils";

/** The three columns both tables end with — label, count, share — are the
 * same fixed widths in both, and both tables hang them off their right edge.
 * That is what puts the tier table's Size / Depositors / Share directly under
 * the Aura legend's Category / Aura / Share: the two panels are the same
 * width and sit in the same layout column, so a column measured back from the
 * right edge lands at the same x in each, whatever is going on to its left.
 *
 * Each width is the widest thing either table puts in that column, measured
 * in the browser: 96 for the label column ("Pre-Deposits" with its dot, 93.1);
 * 72 for the count ("DEPOSITORS", the heading, at 70.2 — wider than any count
 * under it); 42 for the share ("53.4%", 39.8).
 *
 * The tier table adds a FOURTH column in front for the tier name itself, and
 * that one is 1fr — it takes all the slack, which is what keeps its bullets on
 * the panel's left edge, in line with the donut above. */
const LABEL_W = 96;
const COUNT_W = 72;
const SHARE_W = 42;
/** The gap is fluid, not a fixed 36. At 36 flat, the columns plus this
 * panel's ring want more than a 1024-wide layout gives the panel, and the
 * ring — the one thing sized from what's left over — collapsed to 42px to
 * pay for it. Fluid, the gap only reaches its full 36 where there's room.
 * Both tables read the same expression, so they stay in step with each
 * other at every width. */
// Written out literally, not built from the constants below: Tailwind scans
// source text for class names, so a class assembled at runtime generates no
// CSS at all and the gap silently falls back to zero. Keep the two in sync.
const GRID = "grid [column-gap:clamp(16px,2.5vw,36px)]";
const GAP_MIN = 16;
const GAP_MAX = 36;
const GAP_VW = 2.5;

function gapAt(viewportWidth: number): number {
  return Math.min(GAP_MAX, Math.max(GAP_MIN, (GAP_VW / 100) * viewportWidth));
}

/** How far the leading content — the donut in one panel, the tier names in
 * the other — sits in from its card's edge. Applied by both panels so the
 * two stay in line with each other; the trailing columns don't move, since
 * they're measured from the right edge and this only eats into the slack on
 * the left. AuraDonut also subtracts it before sizing the ring, because a
 * row's clientWidth counts its own padding and would otherwise hand the ring
 * width that isn't there. */
export const METRIC_TABLE_LEAD_INSET = 20;

// minmax rather than bare lengths: a narrow viewport can leave the panel
// thinner than the columns together, and rigid columns would push their
// content out through the card's edge. Letting the label column give way
// first hands its own `truncate` the job it's there for.
const TRAILING_COLS = `minmax(0, ${LABEL_W}px) ${COUNT_W}px ${SHARE_W}px`;
const TWO_TRAILING = `minmax(0, ${LABEL_W}px) ${COUNT_W}px`;

/** With no leading column, the trailing columns have to be pushed to the
 * right edge explicitly; with one, its 1fr does the pushing. */
const TWO_COL = { template: TWO_TRAILING, justify: "justify-end" };
const TWO_COL_WIDE = { template: `minmax(0, 1fr) ${COUNT_W}px`, justify: "" };
const THREE_COL = { template: TRAILING_COLS, justify: "justify-end" };
const FOUR_COL = { template: `minmax(0, 1fr) ${TRAILING_COLS}`, justify: "" };

function shapeFor(columnCount: number) {
  if (columnCount === 2) return TWO_COL;
  if (columnCount === 4) return FOUR_COL;
  return THREE_COL;
}

/** Bullet width plus its gap to the name. Every cell in a label column is
 * indented by it — the ones holding a dot so the heading lines up with the
 * text rather than the dot, and the ones without so their text still starts
 * at the same x as the text in the label column above them. */
const BULLET_INSET = "pl-[17px]";

/** Every row of every one of these tables is exactly this tall, in both
 * tables, whatever height its panel happens to have — set here rather than
 * left to line-height so the Aura legend's four rows and the tier table's
 * six sit on the same rhythm instead of each table pacing itself off its own
 * row count. Paired with shrink-0 on the row: these sit in a flex column, so
 * without it a short panel squeezes the rows, and it squeezes the six-row
 * table harder than the four-row one — which is exactly the mismatch the
 * fixed height is here to prevent. */
const ROW_H = 30;

/** The narrowest the label/count/share block can render without its label
 * column collapsing — for callers that have to reserve room for one before
 * it exists. Takes the viewport width because the gap between the columns
 * depends on it. */
export function metricTableMinWidth(
  viewportWidth: number,
  { share = true }: { share?: boolean } = {}
): number {
  if (!share) return LABEL_W + COUNT_W + gapAt(viewportWidth);
  return LABEL_W + COUNT_W + SHARE_W + gapAt(viewportWidth) * 2;
}

const HEADING = "text-[10px] uppercase tracking-[0.1em] text-text-muted";

export function MetricTableHeader({
  columns,
  wide,
}: {
  /** Two headings hide the share column (Aura sources — shares live on the
   * bar chart beside it). Three is the plain legend. Four for a row with a
   * secondary label — same order and count as the row's cells. */
  columns:
    | readonly [string, string]
    | readonly [string, string, string]
    | readonly [string, string, string, string];
  /** Stretch the label column across leftover width. Aura sources sits the
   * legend next to a height-capped ring, so without this the two-col grid
   * stays 168px wide and the rest of the box is a gap. */
  wide?: boolean;
}) {
  const shape = wide && columns.length === 2 ? TWO_COL_WIDE : shapeFor(columns.length);
  return (
    <div
      className={cn(GRID, shape.justify, "shrink-0 border-b border-[var(--color-line)] pb-1.5")}
      style={{ gridTemplateColumns: shape.template }}
    >
      {/* Each heading sits the same way its column's values do, so it always
          reads as belonging to the column beneath it: the first column holds
          the dotted names and is left-aligned (indented past the dots so the
          heading meets the text rather than the dot), every other column is
          flush right. */}
      {columns.map((label, i) => (
        <span
          key={label}
          className={cn(HEADING, i === 0 ? cn("text-left", BULLET_INSET) : "text-right")}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function MetricTableRow({
  color,
  name,
  detail,
  count,
  share,
  active,
  dimmed,
  pulse,
  isFirst,
  wide,
  onMouseEnter,
  onMouseLeave,
}: {
  color: string;
  name: string;
  /** The row's secondary text, e.g. a dollar range. Pass it only on tables
   * that declared a `detail` width — it gets its own column, so a row that
   * supplied one without the width would push the numeric columns over. */
  detail?: string;
  count: string;
  /** Omit on two-column legends — the Aura sources donut drops share because
   * the Category Share chart next to it already shows it. */
  share?: string;
  active: boolean;
  dimmed: boolean;
  /** Pulse this row instead of just tinting it — set when the highlight came
   * from somewhere else on the page (the distribution curve) rather than from
   * the cursor being on this row. Optional: tables with nothing linked to
   * them never pass it. */
  pulse?: boolean;
  /** No divider above the first row — the header's own border-b already
   * draws that line, so a border-t here would double it up. */
  isFirst: boolean;
  /** Match `MetricTableHeader`'s wide two-col template. */
  wide?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const textColor = dimmed ? "#6B6660" : "#F5F3EE";
  // Must match the header's — each row is its own grid container, so the
  // columns line up only because every one is handed the same template.
  const shape =
    detail != null ? FOUR_COL : share != null ? THREE_COL : wide ? TWO_COL_WIDE : TWO_COL;
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        GRID,
        shape.justify,
        "shrink-0 cursor-pointer items-center transition-colors",
        !isFirst && "border-t border-[var(--color-line-soft)]",
        // The pulse animates the same background, so the static tint would
        // only be the colour it starts from — let one or the other own it.
        active && !pulse && "bg-[rgba(255,255,255,0.03)]",
        active && pulse && "tier-row-pulse"
      )}
      // An explicit height rather than vertical padding: padding leaves the
      // row's height at the mercy of its tallest text, and the tier table's
      // rows carry a dollar range the Aura legend's don't, so the two tables
      // paced their rows differently. Fixed here, both march to the same step.
      style={{ gridTemplateColumns: shape.template, height: ROW_H }}
    >
      {/* justify-start, not centred: centring the dot and name together as one
          group shifts the dot by half of whatever the name's width is, so a
          column of rows with names of different lengths gets a column of dots
          at as many different x positions. Anchoring the group left puts every
          dot on one vertical line and every name at one starting x. */}
      <span className="flex min-w-0 items-center gap-2 text-[13px]" style={{ color: textColor }}>
        <span
          className="h-[9px] w-[9px] shrink-0 rounded-full transition-transform"
          style={{
            background: color,
            opacity: dimmed ? 0.4 : 1,
            transform: active ? "scale(1.25)" : "scale(1)",
          }}
        />
        <span className="truncate">{name}</span>
      </span>
      {/* Its own cell rather than trailing the name inside one: sharing a cell
          meant each range started wherever its name happened to end, so the
          six of them stepped raggedly down the table instead of forming a
          column. Flush right, like the numeric columns beside it. */}
      {detail != null && (
        <span
          // Same size and colour as every other value in the row. It was a
          // shade smaller while this cell still carried the label column's
          // 17px bullet indent, which left too little room for the longest
          // range; without the indent the full 13px fits.
          className="truncate text-right text-[13px]"
          style={{ color: textColor }}
        >
          {detail}
        </span>
      )}
      {/* Flush right, along with every column except the names. Digits line up
          by place value that way — the thousands column under the thousands
          column — which is the whole reason these are tabular figures. */}
      <span className="text-right text-[13px] tabular-nums" style={{ color: textColor }}>
        {count}
      </span>
      {share != null && (
        <span
          className="text-right text-[13px] font-semibold tabular-nums"
          style={{ color: textColor }}
        >
          {share}
        </span>
      )}
    </div>
  );
}
