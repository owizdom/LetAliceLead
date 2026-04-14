import express from 'express';
import cors from 'cors';
import { rateLimit } from './middleware/rateLimit';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loans';
import portfolioRoutes from './routes/portfolio';
import healthRoutes from './routes/health';
import registryRoutes from './routes/registry';

export function createServer(): express.Application {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());
  app.use(rateLimit);

  app.use('/api/credit', creditRoutes);
  app.use('/api/loans', loanRoutes);
  app.use('/api/portfolio', portfolioRoutes);
  app.use('/api/registry', registryRoutes);
  app.use('/health', healthRoutes);

  app.get('/', (_req, res) => {
    res.json({
      name: 'LetAliceLead',
      description: 'Autonomous central bank for AI agents — powered by PayWithLocus',
      version: '1.0.0',
      endpoints: {
        health: 'GET /health',
        credit: 'POST /api/credit/apply',
        loans: 'POST /api/loans/request',
        portfolio: 'GET /api/portfolio',
        registry: {
          list: 'GET /api/registry',
          get: 'GET /api/registry/:agentId',
          register: 'POST /api/registry/register',
          score: 'POST /api/registry/:agentId/score',
        },
      },
      poweredBy: ['PayWithLocus', 'USDC on Base', 'Locus Wrapped APIs'],
    });
  });

  return app;
}
