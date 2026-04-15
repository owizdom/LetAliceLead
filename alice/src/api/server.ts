import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loans';
import portfolioRoutes from './routes/portfolio';
import healthRoutes from './routes/health';
import registryRoutes from './routes/registry';
import x402HireRoutes from './routes/x402Hire';
import locusWebhookRoutes from './routes/locusWebhook';

export function createServer(): express.Application {
  const app = express();

  // Security + observability — applied before any business logic so every
  // request gets a consistent id, security headers, and a JSON body parser
  // with a sane size cap.
  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: false, // dashboard renders inline styles via Tailwind
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS: comma-separated allowlist or '*' if unset
  const origin = process.env.CORS_ORIGIN || '*';
  if (origin === '*') {
    app.use(cors({ origin: '*' }));
  } else {
    const allowed = origin.split(',').map((s) => s.trim());
    app.use(
      cors({
        origin: (incoming, cb) => {
          if (!incoming || allowed.includes(incoming)) cb(null, true);
          else cb(new Error(`CORS: ${incoming} not in allowlist`));
        },
      })
    );
  }

  // IMPORTANT: mount the Locus webhook BEFORE `express.json()` because HMAC
  // verification needs the raw request bytes. The route mounts its own
  // `express.raw()` parser internally — swapping the order here would cause
  // every signature compare to fail because `express.json()` has already
  // consumed the stream.
  app.use('/api/webhooks/locus', locusWebhookRoutes);

  app.use(express.json({ limit: '256kb' }));
  app.use(rateLimit);

  app.use('/api/credit', creditRoutes);
  app.use('/api/loans', loanRoutes);
  app.use('/api/portfolio', portfolioRoutes);
  app.use('/api/registry', registryRoutes);
  app.use('/api/alice', x402HireRoutes);
  app.use('/health', healthRoutes);

  app.get('/', (_req, res) => {
    res.json({
      name: 'LetAliceLead',
      description: 'Credit & procurement infrastructure for AI agents — powered by PayWithLocus',
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
        hireX402: {
          discover: 'GET /api/alice/hire (returns 402 + PAYMENT-REQUIRED)',
          settle: 'POST /api/alice/hire (with X-Payment header → runs underwrite + on-chain disbursement)',
        },
        webhooks: {
          locus: 'POST /api/webhooks/locus (HMAC-SHA256 verified settlement callbacks from Locus)',
        },
      },
      poweredBy: ['PayWithLocus', 'USDC on Base', 'Locus Wrapped APIs'],
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
