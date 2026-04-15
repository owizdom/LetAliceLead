export interface ConstitutionalRules {
  minReserveRatioPct: number;
  emergencyReserveRatioPct: number;
  maxSingleLoanPct: number;
  maxConcentrationPct: number;
  minCreditScore: number;
  maxTermDays: number;
  maxDefaultRatePct: number;
  gracePeriodDays: number;
  defaultAfterDays: number;
  riskCheckIntervalMs: number;
  interestTiers: InterestTier[];
}

export interface InterestTier {
  minScore: number;
  maxScore: number;
  aprPercent: number;
  maxLoanPctOfReserves: number;
}

// These constants are the canonical implementation of soul/constitution.md.
// Article II §1–2 fixes the minimum reserve ratio at 20%; Article VII §2 sets
// the emergency halt threshold at 10%. Any change here without an Article VIII
// amendment to the constitution document is a violation of the rules Alice
// is supposed to enforce on herself.
export const CONSTITUTION: ConstitutionalRules = {
  minReserveRatioPct: 20,
  emergencyReserveRatioPct: 10,
  maxSingleLoanPct: 10,
  maxConcentrationPct: 25,
  minCreditScore: 40,
  maxTermDays: 90,
  maxDefaultRatePct: 5,
  gracePeriodDays: 3,
  defaultAfterDays: 7,
  riskCheckIntervalMs: Number(process.env.RISK_CHECK_INTERVAL_MS) || 600_000,
  interestTiers: [
    { minScore: 80, maxScore: 100, aprPercent: 5, maxLoanPctOfReserves: 10 },
    { minScore: 60, maxScore: 79, aprPercent: 10, maxLoanPctOfReserves: 5 },
    { minScore: 40, maxScore: 59, aprPercent: 18, maxLoanPctOfReserves: 2 },
  ],
};

export function getInterestTier(creditScore: number): InterestTier | null {
  return CONSTITUTION.interestTiers.find(
    (t) => creditScore >= t.minScore && creditScore <= t.maxScore
  ) ?? null;
}

