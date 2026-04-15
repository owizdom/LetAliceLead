import { CONSTITUTION } from '../constitution/rules';
import { getActiveLoans, processDefault, adjustBorrowerRate, processRepayment } from './loanManager';
import { getRiskMetrics, refreshReserves } from './treasury';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { nowTimestamp, formatUSDC } from '../utils/math';
import { getWalletBalance, sweepTo } from '../wallets/manager';
import { getBalance } from '../locus/adapter';

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let cycleCount = 0;

export function startRiskMonitor(): void {
  if (monitorInterval) return;

  const intervalMs = CONSTITUTION.riskCheckIntervalMs;
  logger.info('risk.monitor.start', { intervalMs });

  monitorInterval = setInterval(() => {
    runRiskCycle().catch((err) =>
      logger.error('risk.monitor.cycle.failed', err)
    );
  }, intervalMs);

  runRiskCycle().catch((err) =>
    logger.error('risk.monitor.initial.failed', err)
  );
}

export function stopRiskMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('risk.monitor.stopped', {});
  }
}

async function runRiskCycle(): Promise<void> {
  cycleCount++;
  const cycleId = `risk_${cycleCount}`;
  const now = nowTimestamp();

  await logger.debug('risk.cycle.start', { cycleId });

  await refreshReserves().catch(() => {});

  const activeLoans = getActiveLoans();

  for (const loan of activeLoans) {
    // First: try auto-sweep if this is a managed-wallet loan and the wallet has the funds.
    // This closes the loop automatically without waiting for maturity.
    if (loan.disbursementMode === 'managed' && loan.amountRepaid < loan.terms.totalRepayment) {
      const swept = await attemptAutoSweep(loan.id, loan.borrowerAgentId, loan.terms.totalRepayment - loan.amountRepaid);
      if (swept) continue;
    }

    const defaultThreshold = loan.maturityAt + (CONSTITUTION.defaultAfterDays * 86400);

    if (now > defaultThreshold && loan.amountRepaid < loan.terms.totalRepayment) {
      await logger.warn('risk.loan.default_detected', {
        loanId: loan.id,
        agentId: loan.borrowerAgentId,
        outstanding: formatUSDC(loan.terms.totalRepayment - loan.amountRepaid),
      });
      await processDefault(loan.id);
      continue;
    }

    const gracePeriod = CONSTITUTION.gracePeriodDays * 86400;
    if (now > loan.maturityAt + gracePeriod && loan.amountRepaid < loan.terms.totalRepayment) {
      const daysLate = Math.floor((now - loan.maturityAt) / 86400);
      loan.riskScore = Math.min(100, loan.riskScore + daysLate * 10);

      const penalty = daysLate * 2;
      adjustBorrowerRate(loan.borrowerAgentId, penalty);

      await logger.warn('risk.loan.late', {
        loanId: loan.id,
        agentId: loan.borrowerAgentId,
        daysLate,
        riskScore: loan.riskScore,
        rateAdjustment: `+${penalty}% APR on next loan`,
      });

      await auditLog('risk.rate_adjustment', {
        agentId: loan.borrowerAgentId,
        loanId: loan.id,
        daysLate,
        penalty: `+${penalty}% APR`,
        reason: 'Late repayment detected — autonomous monetary policy adjustment',
      });
    }

    loan.lastRiskCheck = now;
  }

  const metrics = getRiskMetrics();

  await auditLog('risk.cycle.report', {
    cycleId,
    activeLoans: activeLoans.length,
    reserveRatio: metrics.reserveRatio,
    defaultRate: metrics.defaultRate,
    concentrationRisk: metrics.concentrationRisk,
    lendingHalted: metrics.lendingHalted,
    haltReason: metrics.haltReason,
  });

  if (metrics.lendingHalted) {
    await logger.warn('risk.lending_halted', {
      reason: metrics.haltReason,
      reserveRatio: metrics.reserveRatio,
      defaultRate: metrics.defaultRate,
    });
  }

  await logger.debug('risk.cycle.complete', {
    cycleId,
    activeLoans: activeLoans.length,
    reserveRatio: `${metrics.reserveRatio.toFixed(1)}%`,
  });
}

/**
 * Attempt to pull outstanding balance from an agent's Alice-custodied wallet
 * back to Alice's treasury. Real on-chain USDC transfer via viem — the sweep
 * works precisely because Alice holds the private key (see wallets/manager.ts).
 * Returns true if the sweep fully covered the outstanding balance.
 */
async function attemptAutoSweep(
  loanId: string,
  agentId: number,
  outstandingWei: bigint
): Promise<boolean> {
  const outstandingFloat = Number(outstandingWei) / 1e6;
  const balance = await getWalletBalance(agentId);
  if (balance < outstandingFloat - 1e-9) {
    // Not enough — surface it for observability
    if (balance > 0) {
      await auditLog('wallet.insufficient_balance', {
        agentId,
        loanId,
        walletBalance: balance,
        needed: outstandingFloat,
      });
    }
    return false;
  }

  // Get Alice's treasury wallet address from Locus
  let treasuryAddress: string | undefined;
  try {
    const bal = await getBalance();
    treasuryAddress = bal.walletAddress;
  } catch (err) {
    await logger.error('wallet.sweep.treasury_unreachable', { error: String(err) });
    return false;
  }
  if (!treasuryAddress) return false;

  const txHash = await sweepTo(agentId, treasuryAddress, outstandingFloat);
  if (!txHash) return false;

  try {
    await processRepayment(loanId, outstandingWei, txHash);
    await logger.info('wallet.auto_repaid', {
      loanId,
      agentId,
      amount: outstandingFloat,
      txHash,
    });
    return true;
  } catch (err) {
    await logger.error('wallet.auto_repaid.record_failed', {
      loanId,
      agentId,
      error: String(err),
    });
    return false;
  }
}

export function getCycleCount(): number {
  return cycleCount;
}
