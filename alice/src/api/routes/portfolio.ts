import { Router, Request, Response } from 'express';
import { getPortfolio, getRiskMetrics } from '../../core/treasury';
import { getCycleCount } from '../../core/riskMonitor';
import { getAuditLog, computeProcurement, ProcurementSummary, getMostRecentMonologue } from '../../locus/audit';
import { getCatalog } from '../../locus/pricing';
import { serializeBigInts } from '../../utils/crypto';
import { PortfolioDashboard } from '../../types';
import { getBalance } from '../../locus/adapter';
import { getActiveLoans } from '../../core/loanManager';
import { getCachedPrice, getAllCachedPrices } from '../../core/collateralMonitor';
import { getAllAgents } from '../../registry/agents';
import { ANCHOR_DISBURSEMENTS, asDisbursementRecord, DisbursementRecord } from '../../locus/anchorDisbursements';

const router = Router();
const startTime = Date.now();

// GET /api/portfolio — full dashboard
router.get('/', async (_req: Request, res: Response) => {
  try {
    const portfolio = getPortfolio();
    const metrics = getRiskMetrics();
    const procurement: ProcurementSummary = computeProcurement();

    let bankWallet = 'unknown';
    try {
      const bal = await getBalance();
      bankWallet = bal.walletAddress || 'unknown';
    } catch {
      // Locus may not be configured
    }

    // Cross-chain collateral aggregates
    const activeLoans = getActiveLoans();
    const collateralized = activeLoans.filter((l) => l.collateral);
    const crossChainCollateralUsd = collateralized.reduce(
      (sum, l) => sum + (l.collateral?.pricedUsdc || 0),
      0
    );
    const averageLtvPct =
      collateralized.length > 0
        ? collateralized.reduce((sum, l) => sum + (l.collateral?.ltvPct || 0), 0) /
          collateralized.length
        : 0;
    const marginCallCount = collateralized.filter(
      (l) => l.collateral?.health === 'margin_call'
    ).length;

    // Live price ticker — STRK + ETH from CoinGecko cache, Sovra from registry liveState
    const strk = getCachedPrice('STRK');
    const eth = getCachedPrice('ETH');
    const sovraAgent = getAllAgents().find((a) => a.liveState?.source === 'sovra');
    const sovraData = sovraAgent?.liveState?.data as
      | { auction?: { topBid?: { amountUsdc?: number }; nextSettleAt?: number; bidCount?: number } }
      | undefined;

    const priceTicker = {
      strkUsd: strk?.usd ?? 0,
      strkChange24h: strk?.usd24hChange ?? null,
      ethUsd: eth?.usd ?? 0,
      ethChange24h: eth?.usd24hChange ?? null,
      sovraTopBidUsdc: sovraData?.auction?.topBid?.amountUsdc ?? null,
      sovraBidCount: sovraData?.auction?.bidCount ?? 0,
      sovraNextSettleAt: sovraData?.auction?.nextSettleAt ?? null,
      pricesAt: Math.max(strk?.fetchedAt ?? 0, eth?.fetchedAt ?? 0),
    };

    const dashboard: PortfolioDashboard & {
      procurement: ProcurementSummary;
      vendorCatalog: ReturnType<typeof getCatalog>;
      latestMonologue: ReturnType<typeof getMostRecentMonologue>;
      crossChainCollateralUsd: number;
      averageLtvPct: number;
      marginCallCount: number;
      priceTicker: typeof priceTicker;
      pricesByAsset: ReturnType<typeof getAllCachedPrices>;
    } = {
      portfolio,
      metrics,
      bankWallet,
      uptime: Date.now() - startTime,
      procurement,
      vendorCatalog: getCatalog(),
      latestMonologue: getMostRecentMonologue(),
      crossChainCollateralUsd,
      averageLtvPct,
      marginCallCount,
      priceTicker,
      pricesByAsset: getAllCachedPrices(),
    };

    res.json(serializeBigInts(dashboard));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/portfolio/metrics — risk metrics only
router.get('/metrics', (_req: Request, res: Response) => {
  const metrics = getRiskMetrics();
  res.json(serializeBigInts(metrics));
});

// GET /api/portfolio/disbursements — recent CONFIRMED loan disbursements
// pulled from Locus's transaction history, MERGED with the anchor
// disbursements imported from anchorDisbursements.ts (single source of truth).
// Locus's tx history caps at 200 most-recent records; anchors guarantee the
// historical proof remains visible regardless of pagination.
router.get('/disbursements', async (_req: Request, res: Response) => {
  let live: DisbursementRecord[] = [];
  try {
    const { LOCUS_API_KEY, LOCUS_API_BASE } = process.env;
    if (LOCUS_API_KEY) {
      const base = LOCUS_API_BASE || 'https://beta-api.paywithlocus.com/api';
      const r = await fetch(`${base}/pay/transactions?limit=200`, {
        headers: { Authorization: `Bearer ${LOCUS_API_KEY}` },
      });
      if (r.ok) {
        const body = (await r.json()) as {
          data?: {
            transactions?: Array<{
              id: string;
              status: string;
              amount_usdc: string;
              memo?: string;
              to_address: string;
              created_at: string;
              tx_hash?: string;
            }>;
          };
        };
        const txs = body.data?.transactions || [];
        live = txs
          .filter(
            (t) =>
              t.status === 'CONFIRMED' &&
              (t.memo || '').toLowerCase().includes('letalicelead loan')
          )
          .map((t) => ({
            id: t.id,
            amountUsdc: Number(t.amount_usdc),
            memo: t.memo || '',
            toAddress: t.to_address,
            createdAt: t.created_at,
            txHash: t.tx_hash || '',
            basescanUrl: t.tx_hash ? `https://basescan.org/tx/${t.tx_hash}` : '',
          }));
      }
    }
  } catch {
    /* fall through to anchors-only */
  }

  // Merge: live first (newest), then anchors not already in live (deduped by tx hash)
  const liveHashes = new Set(live.map((d) => d.txHash).filter(Boolean));
  const anchorsNotInLive = ANCHOR_DISBURSEMENTS
    .filter((a) => !liveHashes.has(a.txHash))
    .map(asDisbursementRecord);
  const merged = [...live, ...anchorsNotInLive].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({ count: merged.length, disbursements: merged });
});

// GET /api/portfolio/audit — audit log
router.get('/audit', (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const log = getAuditLog(limit);
  res.json({
    count: log.length,
    riskCycles: getCycleCount(),
    entries: serializeBigInts(log),
  });
});

export default router;
