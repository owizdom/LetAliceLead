/**
 * x402 inbound endpoint — agent-to-agent hire.
 *
 * Other agents call POST /api/alice/hire to request a USDC loan. First call
 * with no `X-Payment` header returns HTTP 402 + PAYMENT-REQUIRED metadata
 * describing the tiny upfront "underwriting fee" they must settle (0.01 USDC
 * on Base). On the retry with a well-formed X-Payment header, Alice runs the
 * full underwriting pipeline via processLoanApplication and — on approval —
 * disburses the loan on-chain through Locus. The response surfaces the
 * resulting BaseScan tx hash so the caller has verifiable on-chain proof.
 *
 * Payment verification note: the x402 spec calls for EIP-712 signature
 * verification + on-chain settle. For this hackathon handshake we accept a
 * well-formed `X-Payment` header (scheme `exact`, network `base`, parseable
 * EIP-3009 authorization pointing at Alice's wallet) without invoking a
 * facilitator. The actual loan disbursement IS fully on-chain via Locus, so
 * the caller still ends up with a BaseScan-verifiable tx — the simplification
 * is only in the fee-collection leg.
 */

import { Router, Request, Response } from 'express';
import { getBalance } from '../../locus/adapter';
import { processLoanApplication } from '../../core/loanManager';
import { LoanApplication, LoanPurpose } from '../../types';
import { parseUSDC } from '../../utils/math';
import { serializeBigInts } from '../../utils/crypto';
import { auditLog } from '../../locus/audit';
import { logger } from '../../utils/logger';

const router = Router();

// Canonical USDC contract on Base mainnet (6 decimals).
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// 0.01 USDC in atomic units (6 decimals). Kept deliberately small so judges
// can observe the 402 handshake without a real-money settlement loop.
const HIRE_FEE_ATOMIC = '10000';
const HIRE_FEE_USDC = 0.01;

const VALID_PURPOSES: LoanPurpose[] = [
  'compute',
  'inference',
  'scaling',
  'cashflow',
  'api_access',
  'other',
];

// Cache Alice's Locus wallet address for 60s so each hire probe doesn't hit
// /pay/balance. First call resolves it; subsequent calls reuse.
let walletCache: { address: string; expiresAt: number } | null = null;

async function resolveAliceWallet(): Promise<string> {
  if (walletCache && walletCache.expiresAt > Date.now()) {
    return walletCache.address;
  }
  const bal = await getBalance();
  if (!bal.walletAddress) throw new Error('Alice wallet address unavailable from Locus');
  walletCache = { address: bal.walletAddress, expiresAt: Date.now() + 60_000 };
  return bal.walletAddress;
}

function buildAccepts(payToAddress: string, resourceUrl: string) {
  return [
    {
      scheme: 'exact',
      network: 'base',
      maxAmountRequired: HIRE_FEE_ATOMIC,
      resource: resourceUrl,
      description:
        'Hire Alice to underwrite and disburse a USDC loan on Base. Returns on-chain Base tx hash.',
      mimeType: 'application/json',
      payTo: payToAddress,
      maxTimeoutSeconds: 120,
      asset: USDC_BASE,
      extra: { name: 'USDC', version: '2' },
    },
  ];
}

function base64Json(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

/**
 * Parse a client-provided `X-Payment` header. Returns null on any decode
 * error (malformed base64, non-JSON, missing required fields). We accept
 * minimal well-formed shape rather than full EIP-712 verification — see
 * the module docstring for why.
 */
function parseXPayment(
  raw: string,
  expectedPayTo: string
): { scheme: string; network: string; payer?: string; txHash?: string } | null {
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as {
      scheme?: unknown;
      network?: unknown;
      payload?: {
        authorization?: { to?: unknown; from?: unknown };
        signature?: unknown;
        txHash?: unknown;
      };
    };
    if (parsed.scheme !== 'exact' || parsed.network !== 'base') return null;
    const auth = parsed.payload?.authorization;
    if (auth?.to && typeof auth.to === 'string') {
      if (auth.to.toLowerCase() !== expectedPayTo.toLowerCase()) return null;
    }
    return {
      scheme: String(parsed.scheme),
      network: String(parsed.network),
      payer: typeof auth?.from === 'string' ? auth.from : undefined,
      txHash: typeof parsed.payload?.txHash === 'string' ? parsed.payload.txHash : undefined,
    };
  } catch {
    return null;
  }
}

function resourceUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.headers['host'] || 'alice-production-e32b.up.railway.app';
  return `${proto}://${host}${req.originalUrl.split('?')[0]}`;
}

async function respond402(req: Request, res: Response, error: string): Promise<void> {
  try {
    const payTo = await resolveAliceWallet();
    const accepts = buildAccepts(payTo, resourceUrl(req));
    res
      .status(402)
      .setHeader('X-Payment-Required', base64Json({ x402Version: 1, accepts }))
      .setHeader('Content-Type', 'application/json')
      .json({ x402Version: 1, error, accepts });
  } catch (err) {
    // Locus unreachable — degrade to a static 402 without a live payTo so
    // the protocol handshake still advertises the primitive.
    const accepts = buildAccepts('', resourceUrl(req));
    res
      .status(402)
      .setHeader('X-Payment-Required', base64Json({ x402Version: 1, accepts }))
      .setHeader('Content-Type', 'application/json')
      .json({
        x402Version: 1,
        error: `${error} (wallet resolution failed: ${String(err).slice(0, 120)})`,
        accepts,
      });
  }
}

// GET for x402 discovery — some clients probe before POSTing.
router.get('/hire', async (req: Request, res: Response) => {
  await respond402(req, res, 'X-Payment header required');
});

// POST is the real handshake.
router.post('/hire', async (req: Request, res: Response) => {
  const headerRaw = req.header('X-Payment') || req.header('x-payment');

  if (!headerRaw) {
    await respond402(req, res, 'X-Payment header required');
    return;
  }

  let aliceWallet: string;
  try {
    aliceWallet = await resolveAliceWallet();
  } catch (err) {
    res.status(503).json({ error: 'Locus wallet resolution failed', detail: String(err).slice(0, 200) });
    return;
  }

  const parsed = parseXPayment(headerRaw, aliceWallet);
  if (!parsed) {
    await respond402(req, res, 'X-Payment header malformed or scheme/network/payTo mismatch');
    return;
  }

  const { agentId, agentWallet, amount, purpose, termDays, collateral } = req.body as {
    agentId?: unknown;
    agentWallet?: unknown;
    amount?: unknown;
    purpose?: unknown;
    termDays?: unknown;
    collateral?: {
      chain?: unknown;
      asset?: unknown;
      wallet?: unknown;
      amount?: unknown;
    };
  };

  if (!agentId || !agentWallet || !amount) {
    res.status(400).json({ error: 'Missing required fields: agentId, agentWallet, amount' });
    return;
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number (in USDC)' });
    return;
  }

  const numTermDays = Number(termDays) || 1;

  const validPurpose: LoanPurpose = VALID_PURPOSES.includes(purpose as LoanPurpose)
    ? (purpose as LoanPurpose)
    : 'other';

  const application: LoanApplication = {
    agentId: Number(agentId),
    agentWallet: String(agentWallet),
    requestedAmount: parseUSDC(numAmount),
    purpose: validPurpose,
    proposedTermDays: numTermDays,
    collateral:
      collateral && typeof collateral === 'object' && collateral.chain && collateral.asset
        ? {
            chain: String(collateral.chain) as LoanApplication['collateral'] extends infer T
              ? T extends { chain: infer C }
                ? C
                : never
              : never,
            asset: String(collateral.asset),
            wallet: String(collateral.wallet || agentWallet),
            amount: Number(collateral.amount) || 0,
          }
        : undefined,
  };

  try {
    await auditLog('x402.hire.paid_request', {
      agentId: application.agentId,
      amountUsdc: numAmount,
      payer: parsed.payer ?? null,
      headerTxHash: parsed.txHash ?? null,
      feeUsdc: HIRE_FEE_USDC,
    });

    const decision = await processLoanApplication(application);

    if (!decision.approved) {
      // A rejected underwrite is still a successful x402 handshake — the
      // service ran, returned a definitive answer. Use 200 with approved=false
      // so the caller can introspect the rejection reason.
      res
        .status(200)
        .setHeader(
          'X-Payment-Response',
          base64Json({
            success: true,
            transaction: parsed.txHash ?? null,
            network: 'base',
            payer: parsed.payer ?? null,
          })
        )
        .json({
          success: true,
          approved: false,
          decision: serializeBigInts(decision),
        });
      return;
    }

    const loan = decision.loan!;
    const txHash = loan.txHash;
    res
      .status(200)
      .setHeader(
        'X-Payment-Response',
        base64Json({
          success: true,
          transaction: parsed.txHash ?? loan.locusTxId,
          network: 'base',
          payer: parsed.payer ?? null,
        })
      )
      .json({
        success: true,
        approved: true,
        decision: serializeBigInts(decision),
        proof: {
          locusTxId: loan.locusTxId,
          txHash: txHash ?? null,
          basescanUrl: txHash ? `https://basescan.org/tx/${txHash}` : null,
          note: txHash
            ? undefined
            : 'Base mainnet tx hash will resolve within ~60s; poll GET /api/loans/:id for the updated txHash.',
        },
      });
  } catch (err) {
    await logger.error('x402.hire.processing_failed', {
      agentId: application.agentId,
      error: String(err).slice(0, 300),
    });
    res.status(500).json({ error: 'processing_failed', detail: String(err).slice(0, 200) });
  }
});

export default router;
