import { buildLiveFinancialPayloadFromDisk } from "@/lib/live-financial-payload";
import type { LiveFinancialPayload } from "@/lib/live-financial-payload";

/** Once per process (build or serverless cold start), not per request.
 * Referencing this from the root layout keeps tab switches from re-scanning
 * the leaderboard on the server. The client provider still polls live numbers. */
export const LIVE_FINANCIAL_SEED: LiveFinancialPayload =
  buildLiveFinancialPayloadFromDisk();
