import { Router, Request, Response } from 'express';
import { processLoanApplication, processRepayment, getLoan, getActiveLoans, getAllLoans } from '../../core/loanManager';
import { getRiskMetrics } from '../../core/treasury';
import { verifyAgent } from '../middleware/verifyAgent';
import { serializeBigInts } from '../../utils/crypto';
import { parseUSDC } from '../../utils/math';
import { LoanApplication, LoanPurpose } from '../../types';
import { CONSTITUTION } from '../../constitution/rules';

const VALID_PURPOSES: LoanPurpose[] = ['compute', 'inference', 'scaling', 'cashflow', 'api_access', 'other'];

const router = Router();

// POST /api/loans/request — apply for a loan
router.post('/request', verifyAgent, async (req: Request, res: Response) => {
  try {
    const { agentId, agentWallet, amount, purpose, termDays } = req.body;

    if (!agentId || !agentWallet || !amount) {
      res.status(400).json({ error: 'Missing required fields: agentId, agentWallet, amount' });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number (in USDC)' });
      return;
    }

    const numTermDays = Number(termDays) || 30;
    if (numTermDays <= 0 || numTermDays > CONSTITUTION.maxTermDays) {
      res.status(400).json({ error: `termDays must be between 1 and ${CONSTITUTION.maxTermDays}` });
      return;
    }

    const validPurpose: LoanPurpose = VALID_PURPOSES.includes(purpose) ? purpose : 'other';

    const metrics = getRiskMetrics();
    if (metrics.lendingHalted) {
      res.status(503).json({
        error: 'Lending is currently halted',
        reason: metrics.haltReason,
      });
      return;
    }

    const application: LoanApplication = {
      agentId: Number(agentId),
      agentWallet,
      requestedAmount: parseUSDC(amount),
      purpose: validPurpose,
      proposedTermDays: numTermDays,
    };

    const decision = await processLoanApplication(application);

    if (decision.approved) {
      res.status(201).json({
        success: true,
        decision: serializeBigInts(decision),
      });
    } else {
      res.status(200).json({
        success: false,
        decision: serializeBigInts(decision),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/loans/:loanId — get loan status
router.get('/:loanId', (req: Request, res: Response) => {
  const loan = getLoan(req.params.loanId);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }
  res.json(serializeBigInts(loan));
});

// POST /api/loans/:loanId/repay — submit a repayment
router.post('/:loanId/repay', async (req: Request, res: Response) => {
  try {
    const { amount, txHash } = req.body;
    if (!amount) {
      res.status(400).json({ error: 'Missing amount' });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    const parsedAmount = parseUSDC(amount);
    // Use provided txHash or generate a reference
    const hash = txHash || `repay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const loan = await processRepayment(req.params.loanId, parsedAmount, hash);
    res.json({
      success: true,
      loan: serializeBigInts(loan),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/loans — list all loans
router.get('/', (_req: Request, res: Response) => {
  const allLoans = getAllLoans();
  res.json({
    count: allLoans.length,
    loans: serializeBigInts(allLoans),
  });
});

export default router;
