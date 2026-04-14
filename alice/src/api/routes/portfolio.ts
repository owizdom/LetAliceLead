import { Router, Request, Response } from 'express';
import { getPortfolio, getRiskMetrics } from '../../core/treasury';
import { getCycleCount } from '../../core/riskMonitor';
import { getAuditLog, computeProcurement, ProcurementSummary, getMostRecentMonologue } from '../../locus/audit';
import { getCatalog } from '../../locus/pricing';
import { serializeBigInts } from '../../utils/crypto';
import { PortfolioDashboard } from '../../types';
import { getBalance } from '../../locus/adapter';

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

    const dashboard: PortfolioDashboard & {
      procurement: ProcurementSummary;
      vendorCatalog: ReturnType<typeof getCatalog>;
      latestMonologue: ReturnType<typeof getMostRecentMonologue>;
    } = {
      portfolio,
      metrics,
      bankWallet,
      uptime: Date.now() - startTime,
      procurement,
      vendorCatalog: getCatalog(),
      latestMonologue: getMostRecentMonologue(),
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
