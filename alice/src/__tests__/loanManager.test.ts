import { describe, it, expect } from 'vitest';
import { adjustBorrowerRate, getBorrowerRateAdjustment } from '../core/loanManager';

describe('loanManager — rate adjustment', () => {
  it('accumulates penalties across multiple late repayments', () => {
    const agentId = 7001;
    expect(getBorrowerRateAdjustment(agentId)).toBe(0);
    adjustBorrowerRate(agentId, 2);
    expect(getBorrowerRateAdjustment(agentId)).toBe(2);
    adjustBorrowerRate(agentId, 4);
    expect(getBorrowerRateAdjustment(agentId)).toBe(6);
  });

  it('applies negative adjustments to decay penalties on successful repayment', () => {
    const agentId = 7002;
    adjustBorrowerRate(agentId, 5);
    expect(getBorrowerRateAdjustment(agentId)).toBe(5);
    adjustBorrowerRate(agentId, -1);
    expect(getBorrowerRateAdjustment(agentId)).toBe(4);
  });

  it('penalties are isolated per borrower', () => {
    const a = 7100;
    const b = 7101;
    adjustBorrowerRate(a, 3);
    adjustBorrowerRate(b, 7);
    expect(getBorrowerRateAdjustment(a)).toBe(3);
    expect(getBorrowerRateAdjustment(b)).toBe(7);
  });
});
