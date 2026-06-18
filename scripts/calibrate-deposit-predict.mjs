import {
  COHORT_USD_HOURS_FACTOR,
  WEEKLY_DEPOSIT_AURA_POOL,
  computeUserWeekUsdHours,
  predictFromCalibratedCohort,
  usdHoursFromEvents,
} from "../lib/deposit-aura-predict.ts";

const WEEK1_END = Date.parse("2026-06-06T13:00:00.000Z");
const WEEK1_START = WEEK1_END - 7 * 24 * 3600 * 1000;
const WEEK2_END = Date.parse("2026-06-13T13:00:00.000Z");
const WEEK2_START = WEEK1_END;

function parseDate(s) {
  const [d, t] = s.split(" ");
  const [dd, mm, yyyy] = d.split("/");
  return Date.parse(`${yyyy}-${mm}-${dd}T${t}.000Z`);
}

const W2_TVL = 35_351_496;
const W1_TVL = 34_105_354;

const wallets = [
  {
    wallet: "6r3jPTdZH25DDVJAUootmYPRHENyDYRy3z1etBazijx5",
    balance: 5234.225619,
    aura: { week1: 312, week2: 222 },
    events: [
      { ts: parseDate("01/06/2026 14:16:27"), type: "deposit", amount: 3627.14 },
      { ts: parseDate("02/06/2026 08:44:17"), type: "deposit", amount: 1607.08 },
    ],
  },
  {
    wallet: "2xW5fXY766e9FbSen855Z8cPnJVWEsPorbShj7Hhhfd1",
    balance: 345.6,
    aura: { week1: 13, week2: 11 },
    events: [
      { ts: parseDate("01/06/2026 13:50:35"), type: "deposit", amount: 1190.23 },
      { ts: parseDate("01/06/2026 14:11:31"), type: "withdraw", amount: 1000 },
      { ts: parseDate("10/06/2026 09:53:21"), type: "deposit", amount: 108.23 },
      { ts: parseDate("11/06/2026 13:48:57"), type: "deposit", amount: 47.14 },
    ],
  },
];

const hoursInWeek = 168;

for (const w of wallets) {
  console.log(`\n=== ${w.wallet.slice(0, 8)}... ===`);

  for (const [label, start, end, aura, tvl] of [
    ["Week1", WEEK1_START, WEEK1_END, w.aura.week1, W1_TVL],
    ["Week2", WEEK2_START, WEEK2_END, w.aura.week2, W2_TVL],
  ]) {
    const actualUsdHours = usdHoursFromEvents(w.events, start, end);
    const cohort = tvl * hoursInWeek * COHORT_USD_HOURS_FACTOR;
    const actualPredict = predictFromCalibratedCohort(actualUsdHours, cohort);

    const modelUsdHours = computeUserWeekUsdHours(
      w.balance,
      { hoursInWeek, hoursUntilSnapshot: 0 },
      "full_week_hold"
    );
    const modelPredict = predictFromCalibratedCohort(modelUsdHours, cohort);

    console.log(label, {
      actualAura: aura,
      actualUsdHours: Math.round(actualUsdHours),
      actualPredict: Math.round(actualPredict),
      modelUsdHours: Math.round(modelUsdHours),
      modelPredict: Math.round(modelPredict),
      cohort: Math.round(cohort),
    });
  }
}

console.log("\nConstants:", {
  COHORT_USD_HOURS_FACTOR,
  POOL: WEEKLY_DEPOSIT_AURA_POOL,
});
