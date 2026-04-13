import { Request, Response, NextFunction } from 'express';
import { isValidAddress } from '../../utils/crypto';

/**
 * Simplified agent verification — validates agentId and wallet format.
 * In production, this would verify against Locus wallet registry.
 */
export async function verifyAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const agentId = req.body?.agentId ?? req.params?.agentId;
  const agentWallet = req.body?.agentWallet;

  if (!agentId) {
    res.status(400).json({ error: 'Missing agentId' });
    return;
  }

  if (agentWallet && !isValidAddress(agentWallet)) {
    res.status(400).json({ error: 'Invalid agentWallet address' });
    return;
  }

  next();
}
