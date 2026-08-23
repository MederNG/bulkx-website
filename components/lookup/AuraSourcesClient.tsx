"use client";

import { useState } from "react";
import type { WalletData } from "@/types";
import type { CategoryBreakdownItem } from "@/lib/aura-category-groups";
import { CategoryCharts } from "@/components/charts/Charts";
import { AuraHunter } from "@/components/lookup/AuraHunter";

/** Client shell: Hunter lookup transforms the Source / Share panels below. */
export function AuraSourcesClient({
  categoryBreakdown,
}: {
  categoryBreakdown: CategoryBreakdownItem[];
}) {
  const [wallet, setWallet] = useState<WalletData | null>(null);

  return (
    <>
      <div id="aura-hunter" className="shrink-0 scroll-mt-24">
        <AuraHunter result={wallet} onResult={setWallet} />
      </div>
      <CategoryCharts
        data={categoryBreakdown}
        wallet={wallet}
        className="min-h-0 flex-1"
      />
    </>
  );
}
