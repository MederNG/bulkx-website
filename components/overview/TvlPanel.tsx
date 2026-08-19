"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Snapshot } from "@/types";
import type { OverviewMetricView } from "@/lib/overview-metrics";
import { PanelCard } from "@/components/overview/PanelCard";
import { HeroTvlChart, TVL_TOGGLE_GROUP_W } from "@/components/overview/HeroTvlChart";
import { useLiveFinancials } from "@/components/live/LiveFinancialProvider";
import { useTvlView } from "@/components/overview/TvlViewContext";
import { buildTvlViews } from "@/lib/overview-metrics";

export function TvlPanel({ snapshots }: { snapshots: Snapshot[] }) {
  const live = useLiveFinancials();
  // Rebuilt from the live poll (not the server-rendered `views` prop) so the
  // toggle stays in step with the KPI card's own live figure.
  const views = buildTvlViews(live.currentTvl, live.projection, live.secondaryMetrics);
  // Shared with the KPI strip rather than held locally: this toggle drives
  // the headline figure in the card at the top of the page as well as the
  // chart below it.
  const { viewId, setViewId } = useTvlView();
  const active: OverviewMetricView = views.find((v) => v.id === viewId) ?? views[0];

  // No PanelLabel and no header row of its own. The title said what the
  // page's own TVL card already says twice over, and between it and the
  // separate toggle row this panel spent two lines on chrome before the
  // chart got any height at all. The Current/Projected control is handed to
  // the chart instead, which sits it beside the range buttons on one line.
  const viewToggle =
    views.length > 1 ? (
      <div
        className="flex shrink-0 gap-1 rounded-lg border border-[var(--color-line-strong)] p-0.5"
        // Same width as the range group beside it — see TVL_TOGGLE_GROUP_W.
        style={{ width: TVL_TOGGLE_GROUP_W }}
      >
        {views.map((view) => {
          const on = view.id === active.id;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => setViewId(view.id)}
              aria-pressed={on}
              className={cn(
                "relative flex-1 rounded-md px-2.5 py-1 text-center text-[11px] transition-colors",
                on
                  ? "font-medium text-[var(--color-bulk-base)]"
                  : "font-medium text-text-secondary hover:text-text-primary"
              )}
            >
              {on && (
                <motion.span
                  layoutId="tvl-toggle-pill"
                  className="absolute inset-0 rounded-md bg-accent"
                  transition={{ type: "spring", stiffness: 480, damping: 32 }}
                />
              )}
              <span className="relative z-10">{view.toggleLabel}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <PanelCard className="h-full flex-1">
      {/* No headline number here either — the TVL figure, its 7D change and
          both sub-stats all live in the KPI card at the top of the page, so
          repeating them would be saying the same thing twice and would cost
          this panel the height the chart wants. */}
      <HeroTvlChart
        snapshots={snapshots}
        currentTvl={live.currentTvl}
        projection={live.projection}
        referenceTimeMs={live.referenceTimeMs}
        showProjection={active.id === "projected"}
        viewToggle={viewToggle}
      />
    </PanelCard>
  );
}
