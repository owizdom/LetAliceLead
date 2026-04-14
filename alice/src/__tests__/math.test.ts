import { describe, it, expect } from 'vitest';
import { calculateInterest, calculateReserveRatio, calculateDefaultRate, parseUSDC, formatUSDC } from '../utils/math';

describe('financial math', () => {
  it('reserve ratio is correct: $100 reserves with $20 deployed = 80%', () => {
    const ratio = calculateReserveRatio(BigInt(100_000_000), BigInt(20_000_000));
    expect(ratio).toBe(80);
  });

  it('reserve ratio is 0 when fully deployed', () => {
    const ratio = calculateReserveRatio(BigInt(100_000_000), BigInt(100_000_000));
    expect(ratio).toBe(0);
  });

  it('default rate is correct: 1 of 10 loans defaulted = 10%', () => {
    expect(calculateDefaultRate(10, 1)).toBe(10);
    expect(calculateDefaultRate(0, 0)).toBe(0);
    expect(calculateDefaultRate(20, 1)).toBe(5);
  });

  it('USDC parsing roundtrips through 6 decimals', () => {
    expect(parseUSDC(1)).toBe(BigInt(1_000_000));
    expect(parseUSDC('5.5')).toBe(BigInt(5_500_000));
    expect(formatUSDC(BigInt(1_500_000))).toBe('1.500000 USDC');
  });

  it('simple interest: $100 at 10% APR for 30 days ≈ $0.82', () => {
    const interest = calculateInterest(BigInt(100_000_000), 10, 30);
    // 100 * 0.10 * (30/365) = 0.821917...
    expect(Number(interest) / 1e6).toBeCloseTo(0.8219, 3);
  });
});
