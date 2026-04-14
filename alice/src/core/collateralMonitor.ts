/**
 * Collateral monitor — periodic loop that re-prices each active loan's
 * pledged cross-chain collateral via Locus CoinGecko, recomputes LTV, and
 * marks health (healthy / warn / margin_call).
 *
 * Honest framing: the pledge is a READ-only snapshot. Alice cannot force
 * liquidation off-Base. What she can do: refuse future credit, fire a
 * margin_call, or adjust the borrower's rate via the agent loop.
 *
 * Fits with the agent loop: every collateral price call is a real Locus
 * wrappedCall, so procurement spend scales with book size, not just ticks.
 */

import { wrappedCall } from '../locus/adapter';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { getActiveLoans, getLoan } from './loanManager';
import { getAgent } from '../registry/agents';
import {
  Loan,
  CollateralPledge,
  CollateralChain,
  CollateralAsset,
  CollateralHealth,
} from '../types/loan';

const TICK_MS = Number(process.env.COLLATERAL_TICK_MS) || 120_000;
const STALE_PRICE_MS = 90_000;

let timer: ReturnType<typeof setInterval> | null = null;

// Minimal CoinGecko id mapping. Every pledge asset maps to one of these.
const COINGECKO_IDS: Record<string, string> = {
  STRK: 'starknet',
  ETH: 'ethereum',
  USDC: 'usd-coin',
};

// In-memory price cache used by both the monitor and the price-ticker route.
const priceCache = new Map<string, { usd: number; usd24hChange?: number; fetchedAt: number }>();

export function getCachedPrice(asset: CollateralAsset): { usd: number; usd24hChange?: number; fetchedAt: number } | undefined {
  return priceCache.get(asset);
}

export function getAllCachedPrices(): Record<string, { usd: number; usd24hChange?: number; fetchedAt: number }> {
  const out: Record<string, { usd: number; usd24hChange?: number; fetchedAt: number }> = {};
  for (const [asset, entry] of priceCache.entries()) out[asset] = entry;
  return out;
}

/**
 * Fetch USD price for a single asset via Locus CoinGecko. Caches for the
 * configured stale window so repeated calls in the same tick reuse the
 * result. Returns 0 on error so callers can decide how to handle a missing
 * feed.
 */
export async function fetchUsdPrice(asset: CollateralAsset): Promise<number> {
  const cached = priceCache.get(asset);
  if (cached && Date.now() - cached.fetchedAt < STALE_PRICE_MS) return cached.usd;

  const id = COINGECKO_IDS[asset];
  if (!id) {
    await logger.warn('collateral.price.unknown_asset', { asset });
    return 0;
  }

  try {
    const start = Date.now();
    const result = await wrappedCall<Record<string, { usd?: number; usd_24h_change?: number }>>(
      'coingecko',
      'simple-price',
      { ids: id, vs_currencies: 'usd', include_24hr_change: true }
    );
    await auditLog('locus.api.coingecko.called', {
      provider: 'coingecko',
      endpoint: 'simple-price',
      latencyMs: Date.now() - start,
      success: true,
    });
    const entry = result?.[id];
    const usd = typeof entry?.usd === 'number' ? entry.usd : 0;
    const usd24hChange =
      typeof entry?.usd_24h_change === 'number' ? entry.usd_24h_change : undefined;
    priceCache.set(asset, { usd, usd24hChange, fetchedAt: Date.now() });
    return usd;
  } catch (err) {
    await auditLog('locus.api.coingecko.called', {
      provider: 'coingecko',
      endpoint: 'simple-price',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Read the current on-chain balance of `asset` for `wallet` from whatever
 * source we already have wired (Bob's heartbeat, registry liveState, etc.).
 *
 * For v1 we only know how to read Bob's chain.ethBalance + chain.stakeAmount.
 * Generic chain reads (Solana, etc.) would land here in future passes.
 */
export function readBorrowerBalance(
  borrowerAgentId: number,
  chain: CollateralChain,
  asset: CollateralAsset
): number | undefined {
  const agent = getAgent(borrowerAgentId);
  if (!agent?.liveState) return undefined;

  // Bob: chain.ethBalance is a string in wei-style format; chain.stakeAmount is STRK
  if (agent.liveState.source === 'bob') {
    const data = agent.liveState.data as {
      chain?: { ethBalance?: string; stakeAmount?: number; isStakedEndur?: boolean };
    };
    if (chain === 'starknet' && asset === 'STRK') {
      return typeof data.chain?.stakeAmount === 'number' ? data.chain.stakeAmount : undefined;
    }
    if (chain === 'ethereum' && asset === 'ETH') {
      const raw = data.chain?.ethBalance;
      if (typeof raw === 'string') return Number(raw);
      if (typeof raw === 'number') return raw;
      return undefined;
    }
  }

  // Sovra: top-level signer wallet — could be extended, but Sovra is a vendor not a borrower.
  return undefined;
}

export function computeCollateralHealth(ltvPct: number): CollateralHealth {
  if (ltvPct <= 70) return 'healthy';
  if (ltvPct <= 90) return 'warn';
  return 'margin_call';
}

/**
 * Pledge fresh collateral on a loan. Called at origination.
 * Performs an immediate price + health computation so the loan is
 * never published with stale-zero values.
 */
export async function pledgeCollateral(
  loanId: string,
  pledge: Pick<CollateralPledge, 'chain' | 'asset' | 'wallet' | 'amount'>
): Promise<CollateralPledge | undefined> {
  const loan = getLoan(loanId);
  if (!loan) return undefined;

  const usdPrice = await fetchUsdPrice(pledge.asset);
  const pricedUsdc = pledge.amount * usdPrice;
  const principalUsd = Number(loan.terms.principalAmount) / 1e6;
  const ltvPct = pricedUsdc > 0 ? (principalUsd / pricedUsdc) * 100 : 0;
  const health = computeCollateralHealth(ltvPct);

  const out: CollateralPledge = {
    ...pledge,
    pricedUsdc,
    ltvPct,
    health,
    lastPricedAt: Date.now(),
  };
  loan.collateral = out;

  await auditLog('collateral.pledged', {
    loanId,
    agentId: loan.borrowerAgentId,
    chain: pledge.chain,
    asset: pledge.asset,
    amount: pledge.amount,
    pricedUsdc,
    ltvPct,
    health,
  });
  return out;
}

/**
 * Refresh a single loan's collateral — re-read borrower balance, re-price,
 * recompute LTV, store. Emits collateral.priced on every call and
 * collateral.ltv.changed when the health bucket changes.
 */
export async function refreshLoanCollateral(loan: Loan): Promise<CollateralPledge | undefined> {
  if (!loan.collateral) return undefined;

  const liveAmount = readBorrowerBalance(
    loan.borrowerAgentId,
    loan.collateral.chain,
    loan.collateral.asset
  );
  const amount = liveAmount ?? loan.collateral.amount;

  const usdPrice = await fetchUsdPrice(loan.collateral.asset);
  const pricedUsdc = amount * usdPrice;
  const principalUsd = Number(loan.terms.principalAmount) / 1e6;
  const ltvPct = pricedUsdc > 0 ? (principalUsd / pricedUsdc) * 100 : 0;
  const health = computeCollateralHealth(ltvPct);
  const prevHealth = loan.collateral.health;

  loan.collateral = {
    ...loan.collateral,
    amount,
    pricedUsdc,
    ltvPct,
    health,
    lastPricedAt: Date.now(),
  };

  await auditLog('collateral.priced', {
    loanId: loan.id,
    agentId: loan.borrowerAgentId,
    asset: loan.collateral.asset,
    amount,
    pricedUsdc,
    ltvPct,
    health,
  });
  if (health !== prevHealth) {
    await auditLog('collateral.ltv.changed', {
      loanId: loan.id,
      agentId: loan.borrowerAgentId,
      from: prevHealth,
      to: health,
      ltvPct,
    });
  }
  return loan.collateral;
}

async function runCollateralCycle(): Promise<void> {
  const loans = getActiveLoans().filter((l) => l.collateral);
  const cycleId = `coll_${Date.now()}`;
  if (loans.length === 0) {
    // Even with no loans, refresh prices once so the ticker has data
    await Promise.all([fetchUsdPrice('STRK'), fetchUsdPrice('ETH')]);
    return;
  }

  await auditLog('collateral.cycle.start', { cycleId, loanCount: loans.length });
  for (const loan of loans) {
    try {
      await refreshLoanCollateral(loan);
    } catch (err) {
      await logger.warn('collateral.refresh.error', {
        loanId: loan.id,
        error: String(err),
      });
    }
  }
  // Flush refreshed pricing to disk so it survives restarts.
  try {
    const { persistLoans } = await import('./loanManager');
    persistLoans();
  } catch {
    /* ignore — best effort */
  }
  await auditLog('collateral.cycle.complete', { cycleId, loanCount: loans.length });
}

export function startCollateralMonitor(): void {
  if (timer) return;
  logger.info('collateral.monitor.start', { tickMs: TICK_MS }).catch(() => {});
  // First cycle 5s after boot so prices populate quickly
  setTimeout(() => {
    void runCollateralCycle().catch((err) =>
      logger.warn('collateral.cycle.error', { error: String(err) })
    );
  }, 5_000);
  timer = setInterval(() => {
    void runCollateralCycle().catch((err) =>
      logger.warn('collateral.cycle.error', { error: String(err) })
    );
  }, TICK_MS);
}

export function stopCollateralMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('collateral.monitor.stopped', {}).catch(() => {});
  }
}
