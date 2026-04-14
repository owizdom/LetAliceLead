import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock wrappedCall so the price oracle calls don't hit Locus during tests.
vi.mock('../locus/adapter', async () => {
  const actual = await vi.importActual<typeof import('../locus/adapter')>('../locus/adapter');
  return {
    ...actual,
    wrappedCall: vi.fn(),
  };
});

import { wrappedCall } from '../locus/adapter';
import { computeCollateralHealth } from '../core/collateralMonitor';

describe('collateralMonitor — health thresholds', () => {
  it('classifies healthy below 70%', () => {
    expect(computeCollateralHealth(0)).toBe('healthy');
    expect(computeCollateralHealth(50)).toBe('healthy');
    expect(computeCollateralHealth(70)).toBe('healthy');
  });

  it('classifies warn between 70 and 90%', () => {
    expect(computeCollateralHealth(70.1)).toBe('warn');
    expect(computeCollateralHealth(85)).toBe('warn');
    expect(computeCollateralHealth(90)).toBe('warn');
  });

  it('classifies margin_call above 90%', () => {
    expect(computeCollateralHealth(90.1)).toBe('margin_call');
    expect(computeCollateralHealth(120)).toBe('margin_call');
  });
});

describe('collateralMonitor — pricing via mocked CoinGecko', () => {
  beforeEach(() => {
    vi.mocked(wrappedCall).mockReset();
  });

  it('caches and returns USD price for a known asset', async () => {
    vi.mocked(wrappedCall).mockResolvedValueOnce({
      ethereum: { usd: 2300, usd_24h_change: 1.5 },
    });
    const { fetchUsdPrice, getCachedPrice } = await import('../core/collateralMonitor');
    const usd = await fetchUsdPrice('ETH');
    expect(usd).toBe(2300);
    const cached = getCachedPrice('ETH');
    expect(cached?.usd).toBe(2300);
    expect(cached?.usd24hChange).toBe(1.5);
  });

  it('returns 0 for an unknown asset and does not call wrappedCall', async () => {
    vi.mocked(wrappedCall).mockClear();
    const { fetchUsdPrice } = await import('../core/collateralMonitor');
    const usd = await fetchUsdPrice('FAKE');
    expect(usd).toBe(0);
    expect(wrappedCall).not.toHaveBeenCalled();
  });
});
