import { describe, it, expect, beforeEach } from 'vitest';
import { auditLog, computeProcurement } from '../locus/audit';

describe('procurement metric', () => {
  beforeEach(async () => {
    // No reset helper; tests rely on additive aggregation.
  });

  it('aggregates wrapped-API calls into per-provider spend using the price table', async () => {
    await auditLog('locus.api.exa.called', { provider: 'exa', latencyMs: 100, success: true });
    await auditLog('locus.api.brave.called', { provider: 'brave', latencyMs: 200, success: true });
    await auditLog('locus.api.exa.called', { provider: 'exa', latencyMs: 110, success: true });
    await auditLog('loan.originated', { agentId: 1 }); // should be ignored

    const summary = computeProcurement();
    // exa = $0.01/call * 2 = $0.02; brave = $0.035/call * 1 = $0.035
    expect(summary.byProvider.exa.calls).toBeGreaterThanOrEqual(2);
    expect(summary.byProvider.brave.calls).toBeGreaterThanOrEqual(1);
    expect(summary.byProvider.exa.usdcPerCall).toBe(0.01);
    expect(summary.byProvider.brave.usdcPerCall).toBe(0.035);
  });

  it('callCount reflects only locus.api.*.called events, not other actions', async () => {
    const before = computeProcurement();
    await auditLog('loan.completed', { loanId: 'x' });
    await auditLog('risk.cycle.report', { cycleId: 'y' });
    const after = computeProcurement();
    expect(after.callCount).toBe(before.callCount);
  });

  it('totalSpendUsdc equals the sum of per-provider spend', async () => {
    await auditLog('locus.api.coingecko.called', { provider: 'coingecko', latencyMs: 50, success: true });
    const summary = computeProcurement();
    const sumOfProviders = Object.values(summary.byProvider).reduce((s, p) => s + p.spendUsdc, 0);
    expect(summary.totalSpendUsdc).toBeCloseTo(sumOfProviders, 6);
  });
});
