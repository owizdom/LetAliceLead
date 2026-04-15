import { Loan, LoanStatus, LoanTerms, LoanApplication, LoanDecision } from '../types';
import { CONSTITUTION, getInterestTier } from '../constitution/rules';
import { computeCreditScore } from './creditScoring';
import { getTreasury, deployCapital, returnCapital, writeOffCapital, recordInterest, getRiskMetrics } from './treasury';
import { transferUSDC, getOnChainHash } from '../locus/adapter';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { ANCHOR_DISBURSEMENTS } from '../locus/anchorDisbursements';
import { CreditDataUnavailableError } from '../locus/scoring-apis';
import { generateLoanId, serializeBigInts } from '../utils/crypto';
import { calculateInterest, nowTimestamp, daysToMs, formatUSDC } from '../utils/math';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

// In-memory loan store, persisted to a JSON file so loans survive restarts.
// One source of truth — the file is the "loan ledger" snapshot.
const LOAN_STORE_PATH = process.env.ALICE_LOAN_STORE_PATH ||
  join(homedir(), '.config', 'alice', 'loans.json');

function loadLoans(): Map<string, Loan> {
  try {
    if (!existsSync(LOAN_STORE_PATH)) return new Map();
    const raw = readFileSync(LOAN_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    const map = new Map<string, Loan>();
    for (const entry of parsed) {
      const loan = revivedLoan(entry);
      if (loan) map.set(loan.id, loan);
    }
    return map;
  } catch {
    return new Map();
  }
}

function revivedLoan(raw: Record<string, unknown>): Loan | null {
  try {
    const terms = raw.terms as Record<string, unknown>;
    return {
      ...(raw as unknown as Loan),
      terms: {
        ...(terms as unknown as LoanTerms),
        principalAmount: BigInt(String(terms.principalAmount)),
        totalRepayment: BigInt(String(terms.totalRepayment)),
      },
      amountRepaid: BigInt(String(raw.amountRepaid ?? '0')),
      repaymentHistory: ((raw.repaymentHistory as unknown[]) || []).map((r) => {
        const e = r as Record<string, unknown>;
        return {
          amount: BigInt(String(e.amount)),
          timestamp: Number(e.timestamp),
          txHash: String(e.txHash),
        };
      }),
    };
  } catch {
    return null;
  }
}

function saveLoans(): void {
  try {
    mkdirSync(join(homedir(), '.config', 'alice'), { recursive: true });
    const arr = [...loans.values()].map((l) => serializeBigInts(l));
    writeFileSync(LOAN_STORE_PATH, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    void logger.warn('loan.persist.failed', { error: String(err) });
  }
}

/**
 * Public hook so background loops (e.g. collateralMonitor) can flush
 * in-place loan mutations to disk without depending on this module's
 * private save function.
 */
export function persistLoans(): void {
  saveLoans();
}

const loans: Map<string, Loan> = loadLoans();

/**
 * Re-deploy capital for any loans loaded from disk on boot. Must be called
 * AFTER initTreasury() — the treasury module's `state` object is not yet
 * initialized at module-import time.
 */
export function restoreOutstandingCapital(): bigint {
  let outstanding = 0n;
  for (const l of loans.values()) {
    if (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.REPAYING) {
      outstanding += l.terms.principalAmount;
    }
  }
  if (outstanding > 0n) deployCapital(outstanding);
  return outstanding;
}

/**
 * Pull historical loan disbursements from Locus's tx history and re-add any
 * that aren't already in the local store. Lets the loan ledger survive total
 * data loss (delete loans.json → next boot re-imports from on-chain truth).
 *
 * Each imported loan is reconstructed from the disbursement memo
 *   "LetAliceLead Loan (mode): X.XX USDC @ Y% APR for Zd to agent #N"
 * and marked ACTIVE with the disbursement timestamp as origination.
 */
export async function syncHistoricalDisbursements(): Promise<{ imported: number; total: number }> {
  const apiKey = process.env.LOCUS_API_KEY;
  const base = process.env.LOCUS_API_BASE || 'https://beta-api.paywithlocus.com/api';
  if (!apiKey) return { imported: 0, total: loans.size };

  let imported = 0;

  // Re-import the historical anchor loans (single source of truth in
  // alice/src/locus/anchorDisbursements.ts) so the loan book is never empty
  // even if Locus tx history has rolled them off the 200-tx window.
  {
    const knownLocusIds = new Set([...loans.values()].map((l) => l.locusTxId || ''));
    for (const a of ANCHOR_DISBURSEMENTS) {
      if (knownLocusIds.has(a.locusTxId)) continue;
      const principal = BigInt(Math.round(a.amountUsdc * 1e6));
      const interest = BigInt(Math.round(a.amountUsdc * (a.apr / 100) * (a.termDays / 365) * 1e6));
      const originatedAt = Math.floor(new Date(a.createdAtIso).getTime() / 1000);
      const loan: Loan = {
        id: `imported_${a.locusTxId}`,
        borrowerAgentId: a.agentId,
        borrowerWallet: a.toAddress,
        disbursedTo: a.toAddress,
        disbursementMode: 'external',
        terms: {
          principalAmount: principal,
          interestRateAPR: a.apr,
          termDays: a.termDays,
          totalRepayment: principal + interest,
          creditScoreAtOrigination: 72,
        },
        purpose: 'api_access',
        status: LoanStatus.ACTIVE,
        locusTxId: a.locusTxId,
        txHash: a.txHash,
        originatedAt,
        maturityAt: originatedAt + a.termDays * 86400,
        amountRepaid: 0n,
        repaymentHistory: [],
        riskScore: 28,
        lastRiskCheck: originatedAt,
      };
      if (a.agentId === 2) {
        loan.collateral = {
          chain: 'starknet', asset: 'STRK', wallet: a.toAddress,
          amount: 319, pricedUsdc: 0, ltvPct: 0,
          health: 'healthy', lastPricedAt: 0,
        };
      }
      loans.set(loan.id, loan);
      imported++;
    }
  }

  try {
    const r = await fetch(`${base}/pay/transactions?limit=200`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) {
      // Locus down — anchors above already imported, save + capital-deploy still runs below
      if (imported > 0) {
        saveLoans();
        let principal = 0n;
        for (const l of loans.values()) {
          if (l.id.startsWith('imported_') && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.REPAYING)) {
            principal += l.terms.principalAmount;
          }
        }
        if (principal > 0n) deployCapital(principal);
      }
      return { imported, total: loans.size };
    }
    const body = (await r.json()) as {
      data?: { transactions?: Array<{
        id: string; status: string; amount_usdc: string; memo?: string;
        to_address: string; created_at: string; tx_hash?: string;
      }>; };
    };
    const txs = body.data?.transactions || [];

    // Build a set of locus tx ids we already track so we don't re-import.
    const knownLocusIds = new Set<string>([...loans.values()].map((l) => l.locusTxId || ''));

    for (const tx of txs) {
      if (tx.status !== 'CONFIRMED') continue;
      if (!(tx.memo || '').toLowerCase().includes('letalicelead loan')) continue;
      if (knownLocusIds.has(tx.id)) continue;

      // Parse memo: "LetAliceLead Loan (mode): X.XXXXXX USDC @ Y% APR for Zd to agent #N"
      const m = (tx.memo || '').match(/Loan\s*\(([^)]+)\):\s*([\d.]+)\s*USDC\s*@\s*([\d.]+)%\s*APR\s*for\s*(\d+)d\s*to\s*agent\s*#(\d+)/i);
      if (!m) continue;
      const [, mode, amountStr, aprStr, daysStr, agentIdStr] = m;
      const amountUsdc = Number(amountStr);
      const apr = Number(aprStr);
      const termDays = Number(daysStr);
      const agentId = Number(agentIdStr);
      if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) continue;

      const principal = BigInt(Math.round(amountUsdc * 1e6));
      const interest = BigInt(Math.round(amountUsdc * (apr / 100) * (termDays / 365) * 1e6));
      const originatedAt = Math.floor(new Date(tx.created_at).getTime() / 1000);

      const loan: Loan = {
        id: `imported_${tx.id}`,
        borrowerAgentId: agentId,
        borrowerWallet: tx.to_address,
        disbursedTo: tx.to_address,
        disbursementMode: (mode === 'managed' || mode === 'external') ? mode : 'external',
        terms: {
          principalAmount: principal,
          interestRateAPR: apr,
          termDays,
          totalRepayment: principal + interest,
          creditScoreAtOrigination: 72, // sane default for re-imported historicals
        },
        purpose: 'api_access',
        status: LoanStatus.ACTIVE,
        locusTxId: tx.id,
        txHash: tx.tx_hash,
        originatedAt,
        maturityAt: originatedAt + termDays * 86400,
        amountRepaid: 0n,
        repaymentHistory: [],
        riskScore: 28,
        lastRiskCheck: originatedAt,
      };
      // Backfill collateral for imported Bob loans (agentId 2) — the
      // collateral monitor will re-price on its first cycle.
      if (agentId === 2) {
        loan.collateral = {
          chain: 'starknet',
          asset: 'STRK',
          wallet: tx.to_address,
          amount: 319,
          pricedUsdc: 0,
          ltvPct: 0,
          health: 'healthy',
          lastPricedAt: 0,
        };
      }
      loans.set(loan.id, loan);
      knownLocusIds.add(tx.id);
      imported++;
    }

    if (imported > 0) {
      saveLoans();
      // Re-deploy capital for the imported active loans so the treasury
      // metrics reflect the outstanding principal.
      let importedPrincipal = 0n;
      for (const l of loans.values()) {
        if (l.id.startsWith('imported_') && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.REPAYING)) {
          importedPrincipal += l.terms.principalAmount;
        }
      }
      if (importedPrincipal > 0n) deployCapital(importedPrincipal);
    }
  } catch (err) {
    void logger.warn('loan.import.failed', { error: String(err) });
  }
  return { imported, total: loans.size };
}

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

  let creditResult;
  if (cachedFresh) {
    creditResult = {
      score: {
        totalScore: cached!.creditScore!,
        identityScore: cached!.scoreBreakdown?.identityScore ?? 0,
        reputationScore: cached!.scoreBreakdown?.reputationScore ?? 0,
        financialScore: cached!.scoreBreakdown?.financialScore ?? 0,
        reasoning:
          cached!.scoreBreakdown?.reasoning ?? `Reused cached score from ${new Date(cached!.scoredAt!).toISOString()}.`,
      },
    };
  } else {
    try {
      creditResult = await computeCreditScore(app.agentId, app.agentWallet, existingDebt);
    } catch (err) {
      // No silent seed-fallback any more — if a Locus wrapped API failed, the
      // applicant's score is genuinely unknown and we refuse to invent one.
      // The borrower is rejected with an honest reason and can re-apply once
      // the data source recovers.
      if (err instanceof CreditDataUnavailableError) {
        await auditLog('loan.rejected', {
          agentId: app.agentId,
          reason: 'credit_data_unavailable',
          factor: err.factor,
          detail: err.reason.slice(0, 200),
        });
        await logger.warn('loan.rejected.credit_data_unavailable', {
          agentId: app.agentId,
          factor: err.factor,
        });
        return {
          approved: false,
          rejectionReason: `Credit scoring unavailable (${err.factor}) — Locus data source temporarily unreachable. Please retry shortly.`,
          creditScore: 0,
        };
      }
      throw err;
    }
  }
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

  // 10. Transfer USDC via Locus — route to the Alice-custodied wallet if the
  // agent has been issued one (Alice generated the keypair locally and holds
  // the key, so she can sweep at maturity). Otherwise fall back to the
  // external wallet the agent registered with — that path is truly
  // non-custodial but Alice cannot auto-sweep, so repayment is borrower-driven.
  const now = nowTimestamp();
  const maturityTimestamp = now + Math.floor(daysToMs(termDays) / 1000);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAgent } = require('../registry/agents') as typeof import('../registry/agents');
  const registered = getAgent(app.agentId);
  const disbursementAddress = registered?.managedWallet || app.agentWallet;
  // Three-way mode: 'subwallet' when the agent has a Locus-scoped subwallet
  // issued through /pay/subwallets (policy-enforced credit ceiling), 'managed'
  // for the legacy Alice-custodied viem keystore path, or 'external' when
  // disbursing directly to the agent's self-custodial address.
  const disbursementMode: 'subwallet' | 'managed' | 'external' = registered?.subwalletId
    ? 'subwallet'
    : registered?.managedWallet
    ? 'managed'
    : 'external';
  const subwalletSuffix = registered?.subwalletId
    ? ` [sub:${registered.subwalletId.slice(0, 8)}]`
    : '';

  // Real on-chain disbursement only — no notional fallback. Every loan
  // either lands on Base with a verifiable tx hash or gets rejected.
  // The previous fallback created off-chain "loans" that the dashboard
  // displayed alongside real disbursements — a credibility leak.
  let txId: string;
  try {
    txId = await transferUSDC(
      disbursementAddress,
      app.requestedAmount,
      `LetAliceLead Loan (${disbursementMode}): ${formatUSDC(app.requestedAmount)} @ ${effectiveAPR}% APR for ${termDays}d to agent #${app.agentId}${subwalletSuffix}`
    );
    await logger.info('loan.funding.onchain', {
      agentId: app.agentId,
      txId,
      mode: 'real',
      disbursedTo: disbursementAddress,
      disbursementMode,
      subwalletId: registered?.subwalletId ?? null,
    });
  } catch (err) {
    const errMsg = String(err);
    await logger.error('loan.funding.failed', { agentId: app.agentId, error: errMsg });
    await auditLog('loan.rejected', {
      agentId: app.agentId,
      reason: 'disbursement_failed',
      error: errMsg.slice(0, 200),
    });
    return {
      approved: false,
      rejectionReason: errMsg.includes('Insufficient USDC balance')
        ? 'Treasury wallet has insufficient USDC for this disbursement.'
        : 'Loan funding transfer failed via Locus.',
      creditScore,
    };
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
  saveLoans();
  deployCapital(app.requestedAmount);

  // Resolve the on-chain Base tx hash so the dashboard can render a
  // BaseScan link. Locus moves QUEUED → CONFIRMED in ~5–60s on Base,
  // so we poll for ~3 minutes before giving up. Every loan is real
  // on-chain at this point — no notional path remains.
  void (async () => {
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      const hash = await getOnChainHash(txId);
      if (hash) {
        loan.txHash = hash;
        saveLoans();
        await auditLog('loan.tx_hash_resolved', {
          loanId: loan.id,
          locusTxId: txId,
          txHash: hash,
          basescan: `https://basescan.org/tx/${hash}`,
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  })();

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

  saveLoans();

  if (loan.amountRepaid >= loan.terms.totalRepayment) {
    loan.status = LoanStatus.COMPLETED;
    saveLoans();
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
  saveLoans();
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
