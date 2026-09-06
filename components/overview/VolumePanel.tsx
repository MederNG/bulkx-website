import { PanelCard } from "@/components/overview/PanelCard";
import { VolumeChart } from "@/components/overview/VolumeChart";

export function VolumePanel() {
  return (
    <PanelCard className="h-full flex-1" glossy glossDelay={-4}>
      <VolumeChart />
    </PanelCard>
  );
}
