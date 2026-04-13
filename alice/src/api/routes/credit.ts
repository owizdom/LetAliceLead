import { Router, Request, Response } from 'express';
import { computeCreditScore } from '../../core/creditScoring';
import { getBorrowerDebt } from '../../core/loanManager';
import { verifyAgent } from '../middleware/verifyAgent';
import { serializeBigInts } from '../../utils/crypto';

const router = Router();

// POST /api/credit/apply — compute credit score for an agent
router.post('/apply', verifyAgent, async (req: Request, res: Response) => {
  try {
    const { agentId, agentWallet } = req.body;

    if (!agentId || !agentWallet) {
      res.status(400).json({ error: 'Missing agentId or agentWallet' });
      return;
    }

    const existingDebt = getBorrowerDebt(Number(agentId));
    const creditScore = await computeCreditScore(Number(agentId), agentWallet, existingDebt);

    res.json({
      success: true,
      creditScore: serializeBigInts(creditScore),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/credit/score/:agentId — quick score lookup
router.get('/score/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const agentWallet = req.query.wallet as string;

    if (isNaN(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }

    if (!agentWallet) {
      res.status(400).json({ error: 'Provide wallet address as ?wallet=0x...' });
      return;
    }

    const existingDebt = getBorrowerDebt(agentId);
    const creditScore = await computeCreditScore(agentId, agentWallet, existingDebt);

    res.json({
      agentId,
      totalScore: creditScore.score.totalScore,
      breakdown: creditScore.score,
      computedAt: creditScore.computedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
