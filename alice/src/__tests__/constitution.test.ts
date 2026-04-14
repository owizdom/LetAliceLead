import { describe, it, expect } from 'vitest';
import { CONSTITUTION, getInterestTier } from '../constitution/rules';

describe('constitution', () => {
  it('tier 80–100 returns 5% APR with 10% max loan ratio', () => {
    const tier = getInterestTier(85);
    expect(tier).not.toBeNull();
    expect(tier!.aprPercent).toBe(5);
    expect(tier!.maxLoanPctOfReserves).toBe(10);
  });

  it('tier 60–79 returns 10% APR with 5% max loan ratio', () => {
    const tier = getInterestTier(70);
    expect(tier).not.toBeNull();
    expect(tier!.aprPercent).toBe(10);
    expect(tier!.maxLoanPctOfReserves).toBe(5);
  });

  it('tier 40–59 returns 18% APR with 2% max loan ratio', () => {
    const tier = getInterestTier(45);
    expect(tier).not.toBeNull();
    expect(tier!.aprPercent).toBe(18);
    expect(tier!.maxLoanPctOfReserves).toBe(2);
  });

  it('score below 40 returns null tier (rejection)', () => {
    expect(getInterestTier(39)).toBeNull();
    expect(getInterestTier(0)).toBeNull();
  });

  it('boundary scores hit the correct tier (40, 60, 80, 100)', () => {
    expect(getInterestTier(40)!.aprPercent).toBe(18);
    expect(getInterestTier(60)!.aprPercent).toBe(10);
    expect(getInterestTier(80)!.aprPercent).toBe(5);
    expect(getInterestTier(100)!.aprPercent).toBe(5);
  });

  it('constitution constants match documented values', () => {
    // Demo-tuned thresholds: see constitution/rules.ts comment.
    expect(CONSTITUTION.minReserveRatioPct).toBe(5);
    expect(CONSTITUTION.emergencyReserveRatioPct).toBe(2);
    expect(CONSTITUTION.maxConcentrationPct).toBe(25);
    expect(CONSTITUTION.minCreditScore).toBe(40);
    expect(CONSTITUTION.maxDefaultRatePct).toBe(5);
    expect(CONSTITUTION.defaultAfterDays).toBe(7);
    expect(CONSTITUTION.gracePeriodDays).toBe(3);
  });
});
