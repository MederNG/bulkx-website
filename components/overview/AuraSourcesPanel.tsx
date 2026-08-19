import type { OverviewDonutSegment } from "@/lib/overview-metrics";
import { AuraDonut } from "@/components/overview/AuraDonut";
import { PanelCard } from "@/components/overview/PanelCard";

export function AuraSourcesPanel({
  donut,
  totalAuraNumber,
}: {
  donut: OverviewDonutSegment[];
  totalAuraNumber: number;
}) {
  return (
    <PanelCard className="h-full flex-1" glossy glossDelay={-8}>
      {/* No PanelLabel here — same reasoning as Depositors by Tier: the
          "Category / Aura / Share" header row already identifies the table,
          and the donut sizes itself off however much vertical room this
          panel has, so the title's own line was a few more px it wasn't
          getting. */}
      {/* items-stretch (the default), not items-center: the donut measures
          this row's height to size itself, and centring would collapse it to
          its own content height — leaving the ring only as tall as the
          legend beside it. It does its own vertical centring inside. */}
      {donut.length > 0 && (
        <div className="flex min-h-0 flex-1">
          <AuraDonut segments={donut} totalAuraNumber={totalAuraNumber} />
        </div>
      )}
    </PanelCard>
  );
}
