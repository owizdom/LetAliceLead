import { CONSTITUTION } from '../constitution/rules';
import { getActiveLoans, processDefault } from './loanManager';
import { getRiskMetrics, refreshReserves } from './treasury';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { nowTimestamp, formatUSDC } from '../utils/math';

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

  // Run immediately
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

  // Refresh Locus balance
  await refreshReserves().catch(() => {});

  const activeLoans = getActiveLoans();

  for (const loan of activeLoans) {
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

      await logger.warn('risk.loan.late', {
        loanId: loan.id,
        agentId: loan.borrowerAgentId,
        daysLate,
        riskScore: loan.riskScore,
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

export function getCycleCount(): number {
  return cycleCount;
}
