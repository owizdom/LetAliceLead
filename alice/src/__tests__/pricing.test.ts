import { describe, it, expect } from 'vitest';
import { getApiCost, getCatalog, WRAPPED_API_COSTS_USDC } from '../locus/pricing';

describe('locus wrapped-API pricing', () => {
  it('returns the documented cost for each known provider', () => {
    expect(getApiCost('exa')).toBe(0.01);
    expect(getApiCost('brave')).toBe(0.035);
    expect(getApiCost('perplexity')).toBe(0.02);
    expect(getApiCost('coingecko')).toBe(0.001);
  });

  it('returns 0 for unknown providers (no panic)', () => {
    expect(getApiCost('unknown_vendor')).toBe(0);
  });

  it('catalog lists all 7 providers used for credit scoring', () => {
    const catalog = getCatalog();
    const providers = catalog.map((c) => c.provider);
    expect(providers).toContain('exa');
    expect(providers).toContain('firecrawl');
    expect(providers).toContain('brave');
    expect(providers).toContain('perplexity');
    expect(providers).toContain('coingecko');
    expect(providers).toContain('tavily');
    expect(providers).toContain('alphavantage');
    expect(catalog).toHaveLength(7);
  });

  it('every catalog entry has positive cost', () => {
    for (const entry of getCatalog()) {
      expect(entry.usdcPerCall).toBeGreaterThan(0);
    }
  });

  it('keys in WRAPPED_API_COSTS_USDC match catalog providers exactly', () => {
    expect(Object.keys(WRAPPED_API_COSTS_USDC).sort()).toEqual(getCatalog().map((c) => c.provider).sort());
  });
});
