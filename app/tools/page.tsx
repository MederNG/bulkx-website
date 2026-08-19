import { CalculatorSection } from "@/components/calculator/Calculators";

export const revalidate = 60;

export default function ToolsPage() {
  return (
    <div className="shell pb-11 pt-5">
      {/* The heading now lives inside CalculatorSection: the tool tabs sit in
          its card, and they need the state that decides which tool is showing
          — state a server component cannot hold. Supply comes from the live
          financials provider, so this route does not wait on the leaderboard. */}
      <CalculatorSection />
    </div>
  );
}
