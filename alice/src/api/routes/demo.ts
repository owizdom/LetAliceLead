import { Router, Request, Response } from 'express';
import { processLoanApplication, processRepayment } from '../../core/loanManager';
import { parseUSDC } from '../../utils/math';
import { logger } from '../../utils/logger';
import { LoanApplication } from '../../types';

const router = Router();

// Demo agent profiles
const DEMO_AGENTS = [
  {
    agentId: 1,
    name: 'ResearchBot-Alpha',
    wallet: '0x1234567890abcdef1234567890abcdef12345678',
    amount: 5,
    purpose: 'api_access' as const,
    termDays: 30,
    description: 'Reliable researcher, high score — borrows to pay for Locus API calls',
    repayMultiplier: 1.0, // repays in full
    repayDelay: 2000,
  },
  {
    agentId: 2,
    name: 'DataCruncher-Beta',
    wallet: '0xabcdef1234567890abcdef1234567890abcdef12',
    amount: 3,
    purpose: 'compute' as const,
    termDays: 14,
    description: 'Moderate risk, repays slightly late — triggers rate adjustment',
    repayMultiplier: 1.0,
    repayDelay: 4000, // 4 seconds late
  },
  {
    agentId: 3,
    name: 'ShadyAgent-Gamma',
    wallet: '0x0000000000000000000000000000000000000001',
    amount: 10,
    purpose: 'cashflow' as const,
    termDays: 7,
    description: 'Poor history, low score — should be DENIED',
    repayMultiplier: 0, // doesn't repay
    repayDelay: 0,
  },
];

// POST /api/demo/run — run all 3 demo agents
router.post('/run', async (_req: Request, res: Response) => {
  try {
    await logger.info('demo.start', { agents: DEMO_AGENTS.length });

    const results: Array<{ agent: string; outcome: string; details: unknown }> = [];

    for (const agent of DEMO_AGENTS) {
      await logger.info('demo.agent.start', { agentId: agent.agentId, name: agent.name });

      const application: LoanApplication = {
        agentId: agent.agentId,
        agentWallet: agent.wallet,
        requestedAmount: parseUSDC(agent.amount),
        purpose: agent.purpose,
        proposedTermDays: agent.termDays,
      };

      const decision = await processLoanApplication(application);

      if (!decision.approved) {
        results.push({
          agent: agent.name,
          outcome: 'DENIED',
          details: {
            creditScore: decision.creditScore,
            reason: decision.rejectionReason,
          },
        });
        await logger.info('demo.agent.denied', {
          agentId: agent.agentId,
          name: agent.name,
          score: decision.creditScore,
          reason: decision.rejectionReason,
        });
        continue;
      }

      results.push({
        agent: agent.name,
        outcome: 'APPROVED',
        details: {
          loanId: decision.loan?.id,
          creditScore: decision.creditScore,
          apr: decision.offeredTerms?.interestRateAPR,
          principal: agent.amount,
        },
      });

      // Schedule repayment if applicable
      if (agent.repayMultiplier > 0 && decision.loan) {
        const loan = decision.loan;
        const repayAmount = loan.terms.totalRepayment;

        // Use setTimeout to simulate delayed repayment
        setTimeout(async () => {
          try {
            await processRepayment(
              loan.id,
              repayAmount,
              `demo_repay_${loan.id}_${Date.now()}`
            );
            await logger.info('demo.agent.repaid', {
              agentId: agent.agentId,
              name: agent.name,
              loanId: loan.id,
            });
          } catch (err) {
            await logger.error('demo.agent.repay_failed', {
              agentId: agent.agentId,
              error: String(err),
            });
          }
        }, agent.repayDelay);
      }
    }

    res.json({
      success: true,
      message: 'Demo agents processed',
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/demo/agents — show demo agent profiles
router.get('/agents', (_req: Request, res: Response) => {
  res.json({
    agents: DEMO_AGENTS.map((a) => ({
      id: a.agentId,
      name: a.name,
      wallet: a.wallet,
      requestAmount: `${a.amount} USDC`,
      purpose: a.purpose,
      description: a.description,
    })),
  });
});

export default router;
