import { Router, Request, Response } from 'express';
import { getRiskMetrics } from '../../core/treasury';
import { getCycleCount } from '../../core/riskMonitor';

const router = Router();
const startTime = Date.now();

router.get('/', (_req: Request, res: Response) => {
  const metrics = getRiskMetrics();

  res.json({
    status: 'ok',
    agent: 'LetAliceLead',
    version: '1.0.0',
    description: 'The first autonomous central bank for AI agents',
    uptime: Date.now() - startTime,
    riskCycles: getCycleCount(),
    lendingActive: !metrics.lendingHalted,
    reserveRatio: `${metrics.reserveRatio.toFixed(1)}%`,
    poweredBy: 'PayWithLocus',
  });
});

export default router;
