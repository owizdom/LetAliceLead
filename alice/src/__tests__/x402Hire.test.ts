/**
 * Smoke tests for the x402 hire endpoint. We mock the Locus adapter so the
 * test doesn't hit the real API, then exercise the 402 discovery branch +
 * the malformed-header rejection branch. Successful-settle branch is not
 * tested end-to-end here because it would invoke processLoanApplication,
 * the treasury, the credit scorer, and Locus writes — out of scope for a
 * smoke test. The x402 protocol correctness is what we want to pin.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../locus/adapter', () => ({
  getBalance: vi.fn().mockResolvedValue({
    available: 5,
    currency: 'USDC',
    walletAddress: '0xddaf890724785a7df46de5b8e4d051a8064e3da4',
  }),
}));

vi.mock('../core/loanManager', () => ({
  processLoanApplication: vi.fn(),
}));

vi.mock('../locus/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import express from 'express';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import x402Hire from '../api/routes/x402Hire';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ALICE_WALLET = '0xddaf890724785a7df46de5b8e4d051a8064e3da4';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/alice', x402Hire);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('x402 /api/alice/hire', () => {
  it('returns HTTP 402 + X-Payment-Required header on unpaid GET', async () => {
    const res = await fetch(`${baseUrl}/api/alice/hire`);
    expect(res.status).toBe(402);
    const header = res.headers.get('x-payment-required');
    expect(header).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(header!, 'base64').toString('utf8'));
    expect(decoded.x402Version).toBe(1);
    expect(Array.isArray(decoded.accepts)).toBe(true);
    const accept = decoded.accepts[0];
    expect(accept.scheme).toBe('exact');
    expect(accept.network).toBe('base');
    expect(accept.asset.toLowerCase()).toBe(USDC_BASE.toLowerCase());
    expect(accept.payTo.toLowerCase()).toBe(ALICE_WALLET.toLowerCase());
  });

  it('uses 6-decimal atomic units (10000 = $0.01 USDC)', async () => {
    const res = await fetch(`${baseUrl}/api/alice/hire`);
    const body = (await res.json()) as {
      accepts: Array<{ maxAmountRequired: string; extra: { name: string } }>;
    };
    expect(body.accepts[0].maxAmountRequired).toBe('10000');
    expect(body.accepts[0].extra.name).toBe('USDC');
  });

  it('returns HTTP 402 on POST with no X-Payment header', async () => {
    const res = await fetch(`${baseUrl}/api/alice/hire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 2, agentWallet: '0x4d8d', amount: 0.05 }),
    });
    expect(res.status).toBe(402);
  });

  it('returns HTTP 402 on POST with malformed X-Payment header', async () => {
    const res = await fetch(`${baseUrl}/api/alice/hire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': 'not-valid-base64-json',
      },
      body: JSON.stringify({ agentId: 2, agentWallet: '0x4d8d', amount: 0.05 }),
    });
    expect(res.status).toBe(402);
  });

  it('returns HTTP 402 when X-Payment payTo does not match Alice', async () => {
    // Well-formed header but authorization.to points at a different wallet
    const wrongPayment = Buffer.from(
      JSON.stringify({
        scheme: 'exact',
        network: 'base',
        payload: {
          authorization: {
            to: '0x0000000000000000000000000000000000000001',
            from: '0x4d8df94a00d8f267ceed9eacbde905928b0afcd8',
          },
          signature: '0xdead',
        },
      }),
      'utf8'
    ).toString('base64');
    const res = await fetch(`${baseUrl}/api/alice/hire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': wrongPayment,
      },
      body: JSON.stringify({ agentId: 2, agentWallet: '0x4d8d', amount: 0.05 }),
    });
    expect(res.status).toBe(402);
  });
});
