import { initLocus } from '../locus/adapter';
import { initEigenAI } from '../adapters/eigenai';
import { initTreasury } from '../core/treasury';
import { startRiskMonitor } from '../core/riskMonitor';
import { createServer } from '../api/server';
import { logger } from '../utils/logger';

export interface AgentConfig {
  port: number;
  bankName: string;
}

export async function createAgent(config: AgentConfig) {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║            LetAliceLead v1.0.0                   ║
  ║   The First Autonomous Central Bank for AI       ║
  ║                                                  ║
  ║   Powered by PayWithLocus                        ║
  ║   USDC on Base │ Wrapped APIs │ Policy Engine    ║
  ╚══════════════════════════════════════════════════╝
  `);

  // 1. Initialize Locus connection
  await logger.info('agent.init.locus', {});
  initLocus();

  // 2. Initialize LLM for credit scoring
  await logger.info('agent.init.llm', {});
  initEigenAI();

  // 3. Initialize treasury (reads Locus wallet balance)
  await logger.info('agent.init.treasury', {});
  await initTreasury();

  // 4. Start risk monitoring
  await logger.info('agent.init.risk_monitor', {});
  startRiskMonitor();

  // 5. Start API server
  const app = createServer();

  app.listen(config.port, () => {
    logger.info('agent.ready', {
      bankName: config.bankName,
      port: config.port,
      endpoints: [
        `POST http://localhost:${config.port}/api/credit/apply`,
        `POST http://localhost:${config.port}/api/loans/request`,
        `GET  http://localhost:${config.port}/api/portfolio`,
        `GET  http://localhost:${config.port}/health`,
      ],
    });
  });

  return { app };
}
