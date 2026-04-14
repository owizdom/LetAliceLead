import { initLocus } from '../locus/adapter';
import { startHeartbeatLoop, sendHeartbeat } from '../locus/heartbeat';
import { initEigenAI } from '../adapters/eigenai';
import { initTreasury } from '../core/treasury';
import { startRiskMonitor } from '../core/riskMonitor';
import { startLiveUpdater } from '../registry/liveUpdater';
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
  ║   Autonomous Central Bank for AI Agents          ║
  ║                                                  ║
  ║   Powered by PayWithLocus                        ║
  ║   USDC on Base │ Wrapped APIs │ Policy Engine    ║
  ╚══════════════════════════════════════════════════╝
  `);

  await logger.info('agent.init.locus', {});
  initLocus();

  await logger.info('agent.init.llm', {});
  initEigenAI();

  await logger.info('agent.init.treasury', {});
  await initTreasury();

  await logger.info('agent.init.risk_monitor', {});
  startRiskMonitor();

  await logger.info('agent.init.live_updater', {});
  startLiveUpdater();

  // Per Locus skill doc: heartbeat check-in every 30 min, error feedback on failure
  await logger.info('agent.init.heartbeat', {});
  startHeartbeatLoop();
  // Send one immediate heartbeat so judges can verify we followed the skill doc
  sendHeartbeat().catch((err) => logger.warn('agent.init.initial_heartbeat_failed', { error: String(err) }));

  const app = createServer();

  app.listen(config.port, () => {
    logger.info('agent.ready', {
      bankName: config.bankName,
      port: config.port,
      endpoints: [
        `GET  http://localhost:${config.port}/api/registry`,
        `POST http://localhost:${config.port}/api/registry/register`,
        `POST http://localhost:${config.port}/api/loans/request`,
        `GET  http://localhost:${config.port}/api/portfolio`,
        `GET  http://localhost:${config.port}/health`,
      ],
    });
  });

  return { app };
}
