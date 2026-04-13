import { Portfolio, RiskMetrics } from '../types';
import { getBankBalance } from '../locus/adapter';
import { getActiveLoans, getCompletedLoans, getDefaultedLoans } from './loanManager';
import { CONSTITUTION } from '../constitution/rules';
import { calculateReserveRatio, calculateDefaultRate, formatUSDC } from '../utils/math';
import { logger } from '../utils/logger';

interface TreasuryState {
  totalReserves: bigint;
  deployedCapital: bigint;
  totalInterestEarned: bigint;
}

const state: TreasuryState = {
  totalReserves: BigInt(0),
  deployedCapital: BigInt(0),
  totalInterestEarned: BigInt(0),
};

export async function initTreasury(): Promise<void> {
  try {
    const { balance } = await getBankBalance();
    state.totalReserves = balance;
  } catch (err) {
    console.warn('[Treasury] Could not fetch Locus balance, starting with 0:', err);
    state.totalReserves = BigInt(0);
  }

  const activeLoans = getActiveLoans();
  state.deployedCapital = activeLoans.reduce(
    (sum, loan) => sum + loan.terms.principalAmount,
    BigInt(0)
  );

  await logger.info('treasury.initialized', {
    reserves: formatUSDC(state.totalReserves),
    deployed: formatUSDC(state.deployedCapital),
    available: formatUSDC(state.totalReserves - state.deployedCapital),
  });
}

export function getTreasury(): TreasuryState {
  return { ...state };
}

export function deployCapital(amount: bigint): void {
  state.deployedCapital += amount;
}

export function returnCapital(amount: bigint): void {
  state.deployedCapital -= amount;
  if (state.deployedCapital < BigInt(0)) state.deployedCapital = BigInt(0);
}

export function writeOffCapital(amount: bigint): void {
  state.deployedCapital -= amount;
  state.totalReserves -= amount;
  if (state.deployedCapital < BigInt(0)) state.deployedCapital = BigInt(0);
  if (state.totalReserves < BigInt(0)) state.totalReserves = BigInt(0);
}

export function recordInterest(amount: bigint): void {
  state.totalInterestEarned += amount;
  state.totalReserves += amount;
}

export async function refreshReserves(): Promise<void> {
  try {
    const { balance } = await getBankBalance();
    state.totalReserves = balance + state.deployedCapital;
  } catch {
    // Keep current state if Locus is unreachable
  }
}

export function getPortfolio(): Portfolio {
  return {
    totalReserves: state.totalReserves,
    deployedCapital: state.deployedCapital,
    availableCapital: state.totalReserves - state.deployedCapital,
    totalInterestEarned: state.totalInterestEarned,
    activeLoans: getActiveLoans(),
    completedLoans: getCompletedLoans(),
    defaultedLoans: getDefaultedLoans(),
    lastUpdated: Date.now(),
  };
}

export function getRiskMetrics(): RiskMetrics {
  const portfolio = getPortfolio();
  const totalLoansCount = portfolio.activeLoans.length + portfolio.completedLoans.length + portfolio.defaultedLoans.length;

  const reserveRatio = state.totalReserves > BigInt(0)
    ? calculateReserveRatio(state.totalReserves, state.deployedCapital)
    : 100;

  const defaultRate = calculateDefaultRate(totalLoansCount, portfolio.defaultedLoans.length);

  const avgCreditScore = portfolio.activeLoans.length > 0
    ? portfolio.activeLoans.reduce((sum, l) => sum + l.terms.creditScoreAtOrigination, 0) / portfolio.activeLoans.length
    : 0;

  const exposureByBorrower = new Map<number, bigint>();
  for (const loan of portfolio.activeLoans) {
    const current = exposureByBorrower.get(loan.borrowerAgentId) ?? BigInt(0);
    exposureByBorrower.set(loan.borrowerAgentId, current + loan.terms.principalAmount);
  }
  let maxConcentration = 0;
  if (state.totalReserves > BigInt(0)) {
    for (const exposure of exposureByBorrower.values()) {
      const pct = Number((exposure * BigInt(10000)) / state.totalReserves) / 100;
      if (pct > maxConcentration) maxConcentration = pct;
    }
  }

  let weightedAPR = 0;
  let totalPrincipal = BigInt(0);
  for (const loan of portfolio.activeLoans) {
    weightedAPR += loan.terms.interestRateAPR * Number(loan.terms.principalAmount);
    totalPrincipal += loan.terms.principalAmount;
  }
  if (totalPrincipal > BigInt(0)) {
    weightedAPR = weightedAPR / Number(totalPrincipal);
  }

  let lendingHalted = false;
  let haltReason: string | undefined;

  if (defaultRate > CONSTITUTION.maxDefaultRatePct) {
    lendingHalted = true;
    haltReason = `Default rate ${defaultRate.toFixed(1)}% exceeds ${CONSTITUTION.maxDefaultRatePct}% limit`;
  }
  if (reserveRatio < CONSTITUTION.emergencyReserveRatioPct) {
    lendingHalted = true;
    haltReason = `Reserve ratio ${reserveRatio.toFixed(1)}% below emergency ${CONSTITUTION.emergencyReserveRatioPct}% threshold`;
  }

  return {
    reserveRatio,
    defaultRate,
    averageCreditScore: Math.round(avgCreditScore),
    concentrationRisk: maxConcentration,
    totalExposure: state.deployedCapital,
    weightedAverageAPR: Math.round(weightedAPR * 100) / 100,
    lendingHalted,
    haltReason,
    computedAt: Date.now(),
  };
}
