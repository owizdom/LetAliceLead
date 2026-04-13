import express from 'express';
import cors from 'cors';
import { rateLimit } from './middleware/rateLimit';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loans';
import portfolioRoutes from './routes/portfolio';
import healthRoutes from './routes/health';
import demoRoutes from './routes/demo';

export function createServer(): express.Application {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());
  app.use(rateLimit);

  // Routes
  app.use('/api/credit', creditRoutes);
  app.use('/api/loans', loanRoutes);
  app.use('/api/portfolio', portfolioRoutes);
  app.use('/health', healthRoutes);
  app.use('/api/demo', demoRoutes);

  // Root
  app.get('/', (_req, res) => {
    res.json({
      name: 'LetAliceLead',
      description: 'The first autonomous central bank for AI agents — powered by Locus',
      version: '1.0.0',
      tagline: 'Alice runs an AI lending business. You keep the profits.',
      endpoints: {
        health: 'GET /health',
        credit: {
          apply: 'POST /api/credit/apply',
          score: 'GET /api/credit/score/:agentId',
        },
        loans: {
          request: 'POST /api/loans/request',
          status: 'GET /api/loans/:loanId',
          repay: 'POST /api/loans/:loanId/repay',
          active: 'GET /api/loans',
        },
        portfolio: {
          dashboard: 'GET /api/portfolio',
          metrics: 'GET /api/portfolio/metrics',
          audit: 'GET /api/portfolio/audit',
        },
      },
      poweredBy: ['PayWithLocus', 'USDC on Base', 'Locus Wrapped APIs'],
    });
  });

  return app;
}
