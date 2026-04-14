import { Router, Request, Response } from 'express';
import { getAllAgents, getAgent, registerAgent, updateAgentScore } from '../../registry/agents';
import { computeCreditScore } from '../../core/creditScoring';
import { serializeBigInts, isValidAddress } from '../../utils/crypto';
import { logger } from '../../utils/logger';

const router = Router();

// GET /api/registry — list all registered agents
router.get('/', (_req: Request, res: Response) => {
  const agents = getAllAgents();
  res.json({ count: agents.length, agents: serializeBigInts(agents) });
});

// GET /api/registry/:agentId — single agent
router.get('/:agentId', (req: Request, res: Response) => {
  const agentId = Number(req.params.agentId);
  const agent = getAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(serializeBigInts(agent));
});

// POST /api/registry/register — anyone can register an agent
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, tagline, description, wallet, chain, github, website } = req.body;
    if (!name || !wallet) {
      res.status(400).json({ error: 'Missing required fields: name, wallet' });
      return;
    }
    if (!isValidAddress(wallet) && chain !== 'starknet' && chain !== 'other') {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }
    const agent = registerAgent({
      name: String(name).slice(0, 80),
      tagline: String(tagline || '').slice(0, 200),
      description: String(description || '').slice(0, 1000),
      wallet,
      chain,
      github,
      website,
    });
    await logger.info('registry.agent.registered', {
      agentId: agent.agentId,
      name: agent.name,
      wallet: agent.wallet,
    });
    res.status(201).json(serializeBigInts(agent));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/registry/:agentId/score — re-score an agent (fires real Locus APIs)
router.post('/:agentId/score', async (req: Request, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const agent = getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const result = await computeCreditScore(agentId, agent.wallet, BigInt(0));
    updateAgentScore(agentId, result.score.totalScore, {
      identityScore: result.score.identityScore,
      reputationScore: result.score.reputationScore,
      financialScore: result.score.financialScore,
      reasoning: result.score.reasoning,
    });
    res.json({
      success: true,
      agentId,
      score: result.score.totalScore,
      breakdown: result.score,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
