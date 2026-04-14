import { Loan, LoanStatus, LoanTerms, LoanApplication, LoanDecision } from '../types';
import { CONSTITUTION, getInterestTier } from '../constitution/rules';
import { computeCreditScore } from './creditScoring';
import { getTreasury, deployCapital, returnCapital, writeOffCapital, recordInterest, getRiskMetrics } from './treasury';
import { transferUSDC } from '../locus/adapter';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { generateLoanId, serializeBigInts } from '../utils/crypto';
import { calculateInterest, nowTimestamp, daysToMs, formatUSDC } from '../utils/math';

// In-memory loan store
const loans: Map<string, Loan> = new Map();

// Rate adjustments — tracks APR penalties for late/problematic borrowers
const rateAdjustments: Map<number, number> = new Map();

/** Apply a rate penalty to a borrower (called by riskMonitor on late repayment) */
export function adjustBorrowerRate(agentId: number, penaltyPct: number): void {
  const current = rateAdjustments.get(agentId) || 0;
  rateAdjustments.set(agentId, current + penaltyPct);
}

/** Get the current rate adjustment for a borrower */
export function getBorrowerRateAdjustment(agentId: number): number {
  return rateAdjustments.get(agentId) || 0;
}

// Simple async mutex
let _lockPromise: Promise<void> = Promise.resolve();
function acquireLock(): Promise<() => void> {
  let release: () => void;
  const prev = _lockPromise;
  _lockPromise = new Promise<void>((resolve) => { release = resolve; });
  return prev.then(() => release!);
}

export function getActiveLoans(): Loan[] {
  return [...loans.values()].filter(
    (l) => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.REPAYING
  );
}

export function getAllLoans(): Loan[] {
  return [...loans.values()];
}

export function getLoan(loanId: string): Loan | undefined {
  return loans.get(loanId);
}

export function getDefaultedLoans(): Loan[] {
  return [...loans.values()].filter((l) => l.status === LoanStatus.DEFAULTED);
}

export function getCompletedLoans(): Loan[] {
  return [...loans.values()].filter((l) => l.status === LoanStatus.COMPLETED);
}

export function getBorrowerDebt(agentId: number): bigint {
  let total = BigInt(0);
  for (const loan of getActiveLoans()) {
    if (loan.borrowerAgentId === agentId) {
      total += loan.terms.totalRepayment - loan.amountRepaid;
    }
  }
  return total;
}

export async function processLoanApplication(app: LoanApplication): Promise<LoanDecision> {
  const release = await acquireLock();
  try {
    return await _processLoanApplication(app);
  } finally {
    release();
  }
}

async function _processLoanApplication(app: LoanApplication): Promise<LoanDecision> {
  await logger.info('loan.application.received', {
    agentId: app.agentId,
    amount: app.requestedAmount.toString(),
    purpose: app.purpose,
    termDays: app.proposedTermDays,
  });

  // 1. Compute credit score via Locus wrapped APIs.
  // If the agent has a recent registry-provided score (seeded or rescored within
  // the last 30min), reuse it to avoid charging Locus per application.
  const existingDebt = getBorrowerDebt(app.agentId);
  const { getAgent: _getAgentForScore } = await import('../registry/agents');
  const cached = _getAgentForScore(app.agentId);
  const cachedFresh =
    cached?.creditScore !== undefined &&
    cached?.scoredAt !== undefined &&
    Date.now() - cached.scoredAt < 30 * 60_000;

  const creditResult = cachedFresh
    ? {
        score: {
          totalScore: cached!.creditScore!,
          identityScore: cached!.scoreBreakdown?.identityScore ?? 0,
          reputationScore: cached!.scoreBreakdown?.reputationScore ?? 0,
          financialScore: cached!.scoreBreakdown?.financialScore ?? 0,
          reasoning:
            cached!.scoreBreakdown?.reasoning ?? `Reused cached score from ${new Date(cached!.scoredAt!).toISOString()}.`,
        },
      }
    : await computeCreditScore(app.agentId, app.agentWallet, existingDebt);
  const creditScore = creditResult.score.totalScore;

  // 2. Check lending halt
  const metrics = getRiskMetrics();
  if (metrics.lendingHalted) {
    return {
      approved: false,
      rejectionReason: `Lending halted: ${metrics.haltReason}`,
      creditScore,
    };
  }

  // 3. Check minimum credit score
  if (creditScore < CONSTITUTION.minCreditScore) {
    await logger.info('loan.rejected.low_score', { agentId: app.agentId, score: creditScore });
    await auditLog('loan.rejected', { agentId: app.agentId, reason: 'low_credit_score', score: creditScore });
    return {
      approved: false,
      rejectionReason: `Credit score ${creditScore} is below minimum ${CONSTITUTION.minCreditScore}. ${creditResult.score.reasoning}`,
      creditScore,
    };
  }

  // 4. Get interest tier
  const tier = getInterestTier(creditScore);
  if (!tier) {
    return {
      approved: false,
      rejectionReason: `No interest tier matches score ${creditScore}`,
      creditScore,
    };
  }

  // 5. Check term limit
  const termDays = Math.min(app.proposedTermDays, CONSTITUTION.maxTermDays);

  // 6. Check constitutional limits
  const treasury = getTreasury();

  if (treasury.totalReserves === BigInt(0)) {
    return {
      approved: false,
      rejectionReason: 'Treasury is empty — no capital available for lending',
      creditScore,
    };
  }

  const maxLoanAmount = (treasury.totalReserves * BigInt(tier.maxLoanPctOfReserves)) / BigInt(100);

  if (app.requestedAmount > maxLoanAmount) {
    return {
      approved: false,
      rejectionReason: `Requested ${formatUSDC(app.requestedAmount)} exceeds max ${formatUSDC(maxLoanAmount)} for your credit tier`,
      creditScore,
    };
  }

  // 7. Check reserve ratio
  const projectedDeployed = treasury.deployedCapital + app.requestedAmount;
  const projectedRatio = Number(
    ((treasury.totalReserves - projectedDeployed) * BigInt(10000)) / treasury.totalReserves
  ) / 100;

  if (projectedRatio < CONSTITUTION.minReserveRatioPct) {
    return {
      approved: false,
      rejectionReason: `Loan would breach reserve ratio (projected ${projectedRatio.toFixed(1)}% < min ${CONSTITUTION.minReserveRatioPct}%)`,
      creditScore,
    };
  }

  // 8. Check concentration
  const borrowerLoans = getActiveLoans().filter((l) => l.borrowerAgentId === app.agentId);
  const borrowerExposure = borrowerLoans.reduce((sum, l) => sum + l.terms.principalAmount, BigInt(0));
  const maxConcentration = (treasury.totalReserves * BigInt(CONSTITUTION.maxConcentrationPct)) / BigInt(100);

  if (borrowerExposure + app.requestedAmount > maxConcentration) {
    return {
      approved: false,
      rejectionReason: `Would exceed concentration limit (${CONSTITUTION.maxConcentrationPct}% of reserves)`,
      creditScore,
    };
  }

  // 9. Compute terms (apply rate adjustment for repeat borrowers)
  const rateAdj = getBorrowerRateAdjustment(app.agentId);
  const effectiveAPR = Math.min(tier.aprPercent + rateAdj, 25); // cap at 25%
  const interest = calculateInterest(app.requestedAmount, effectiveAPR, termDays);
  const totalRepayment = app.requestedAmount + interest;

  if (rateAdj > 0) {
    await logger.info('loan.rate_adjusted', {
      agentId: app.agentId,
      baseAPR: tier.aprPercent,
      adjustment: `+${rateAdj}%`,
      effectiveAPR,
      reason: 'Previous late repayment history',
    });
  }

  const terms: LoanTerms = {
    principalAmount: app.requestedAmount,
    interestRateAPR: effectiveAPR,
    termDays,
    totalRepayment,
    creditScoreAtOrigination: creditScore,
  };

  // 10. Transfer USDC via Locus — route to the managed wallet if the agent has
  // been issued one. That's the "credit card" destination. Otherwise use the
  // external wallet the agent registered with (legacy self-custodial path).
  const now = nowTimestamp();
  const maturityTimestamp = now + Math.floor(daysToMs(termDays) / 1000);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAgent } = require('../registry/agents') as typeof import('../registry/agents');
  const registered = getAgent(app.agentId);
  const disbursementAddress = registered?.managedWallet || app.agentWallet;
  const disbursementMode: 'managed' | 'external' = registered?.managedWallet
    ? 'managed'
    : 'external';

  let txId: string;
  try {
    txId = await transferUSDC(
      disbursementAddress,
      app.requestedAmount,
      `LetAliceLead Loan (${disbursementMode}): ${formatUSDC(app.requestedAmount)} @ ${effectiveAPR}% APR for ${termDays}d to agent #${app.agentId}`
    );
    await logger.info('loan.funding.onchain', { agentId: app.agentId, txId, mode: 'real', disbursedTo: disbursementAddress, disbursementMode });
  } catch (err) {
    const errMsg = String(err);
    // If Locus wallet is unfunded, fall back to notional loan (dev/demo mode)
    // Real on-chain transfer resumes automatically when the wallet is funded
    if (errMsg.includes('Insufficient USDC balance') || errMsg.includes('403')) {
      txId = `notional_${generateLoanId()}`;
      await logger.info('loan.funding.notional', {
        agentId: app.agentId,
        txId,
        mode: 'notional',
        note: 'Locus wallet unfunded — loan recorded but USDC not transferred on-chain',
      });
    } else {
      await logger.error('loan.funding.failed', { agentId: app.agentId, error: errMsg });
      return {
        approved: false,
        rejectionReason: 'Loan funding transfer failed via Locus',
        creditScore,
      };
    }
  }

  // 11. Record the loan
  const loan: Loan = {
    id: generateLoanId(),
    borrowerAgentId: app.agentId,
    borrowerWallet: app.agentWallet,
    disbursedTo: disbursementAddress,
    disbursementMode,
    terms,
    purpose: app.purpose,
    status: LoanStatus.ACTIVE,
    locusTxId: txId,
    originatedAt: now,
    maturityAt: maturityTimestamp,
    amountRepaid: BigInt(0),
    repaymentHistory: [],
    riskScore: 100 - creditScore,
    lastRiskCheck: now,
  };

  loans.set(loan.id, loan);
  deployCapital(app.requestedAmount);

  // Pledge collateral if the application included a pledge. The monitor
  // populates the live pricing fields on the loan in-place.
  if (app.collateral) {
    try {
      const { pledgeCollateral } = await import('./collateralMonitor');
      await pledgeCollateral(loan.id, app.collateral);
    } catch (err) {
      await logger.warn('loan.collateral_pledge_failed', {
        loanId: loan.id,
        error: String(err),
      });
    }
  }

  await auditLog('loan.originated', {
    loanId: loan.id,
    agentId: app.agentId,
    principal: app.requestedAmount.toString(),
    apr: tier.aprPercent,
    termDays,
    totalRepayment: totalRepayment.toString(),
    locusTxId: txId,
    reasoning: creditResult.score.reasoning,
  });

  await logger.info('loan.originated', {
    loanId: loan.id,
    agentId: app.agentId,
    amount: formatUSDC(app.requestedAmount),
    apr: `${tier.aprPercent}%`,
    term: `${termDays}d`,
  });

  return {
    approved: true,
    loan,
    creditScore,
    offeredTerms: terms,
  };
}

export async function processRepayment(loanId: string, amount: bigint, txHash: string): Promise<Loan> {
  const release = await acquireLock();
  try {
    return await _processRepayment(loanId, amount, txHash);
  } finally {
    release();
  }
}

async function _processRepayment(loanId: string, amount: bigint, txHash: string): Promise<Loan> {
  const loan = loans.get(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.status === LoanStatus.COMPLETED || loan.status === LoanStatus.DEFAULTED) {
    throw new Error(`Loan ${loanId} is already ${loan.status}`);
  }

  loan.amountRepaid += amount;
  loan.repaymentHistory.push({
    amount,
    timestamp: nowTimestamp(),
    txHash,
  });
  loan.status = LoanStatus.REPAYING;

  await logger.info('loan.repayment', {
    loanId,
    amount: formatUSDC(amount),
    totalRepaid: formatUSDC(loan.amountRepaid),
    remaining: formatUSDC(loan.terms.totalRepayment - loan.amountRepaid),
  });

  if (loan.amountRepaid >= loan.terms.totalRepayment) {
    loan.status = LoanStatus.COMPLETED;
    returnCapital(loan.terms.principalAmount);
    const interestEarned = loan.amountRepaid - loan.terms.principalAmount;
    recordInterest(interestEarned);

    // Decay any rate penalty on this borrower by 1 point for completing a loan.
    // Paying on time restores trust; chronic late payers still stay penalized.
    const prevAdjustment = getBorrowerRateAdjustment(loan.borrowerAgentId);
    if (prevAdjustment > 0) {
      const decay = Math.min(prevAdjustment, 1);
      adjustBorrowerRate(loan.borrowerAgentId, -decay);
      await auditLog('loan.rate_decay', {
        agentId: loan.borrowerAgentId,
        loanId,
        previousPenalty: prevAdjustment,
        decayedBy: decay,
        newPenalty: prevAdjustment - decay,
        reason: 'Successful repayment',
      });
    }

    await auditLog('loan.completed', {
      loanId,
      agentId: loan.borrowerAgentId,
      principal: loan.terms.principalAmount.toString(),
      interestEarned: interestEarned.toString(),
    });

    await logger.info('loan.completed', { loanId, agentId: loan.borrowerAgentId });
  }

  return loan;
}

export async function processDefault(loanId: string): Promise<void> {
  const release = await acquireLock();
  try {
    await _processDefault(loanId);
  } finally {
    release();
  }
}

async function _processDefault(loanId: string): Promise<void> {
  const loan = loans.get(loanId);
  if (!loan) return;
  // Guard — another handler may have already resolved this loan
  if (loan.status === LoanStatus.DEFAULTED || loan.status === LoanStatus.COMPLETED) return;

  loan.status = LoanStatus.DEFAULTED;
  const outstanding = loan.terms.totalRepayment - loan.amountRepaid;
  // Portion of outstanding balance attributable to interest Alice expected but will never see
  const principalOutstanding = loan.terms.principalAmount > loan.amountRepaid
    ? loan.terms.principalAmount - loan.amountRepaid
    : BigInt(0);
  const interestLost = outstanding - principalOutstanding;

  writeOffCapital(principalOutstanding);

  await auditLog('loan.defaulted', {
    loanId,
    agentId: loan.borrowerAgentId,
    outstanding: outstanding.toString(),
    principalWrittenOff: principalOutstanding.toString(),
    interestForgone: interestLost.toString(),
    principal: loan.terms.principalAmount.toString(),
    amountRepaid: loan.amountRepaid.toString(),
  });

  await logger.warn('loan.defaulted', {
    loanId,
    agentId: loan.borrowerAgentId,
    outstanding: formatUSDC(outstanding),
    principalWrittenOff: formatUSDC(principalOutstanding),
    interestForgone: formatUSDC(interestLost),
  });
}
