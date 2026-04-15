/**
 * Anchor disbursements — Alice's first 3 real on-chain loans to bobIsAlive.
 *
 * Single source of truth. Both portfolio.ts (dashboard endpoint) and
 * loanManager.ts (boot-time historical re-import) consume this list and map
 * to their respective record shapes. Drift between the two views was a real
 * risk before this module existed.
 *
 * Why these exist as code constants at all:
 *  - Locus's /pay/transactions only returns the most recent ~200 records
 *  - Procurement + heartbeat traffic eventually pushes these older loans
 *    off the window, which would empty the loan ledger after data loss
 *  - Each entry is a real ERC-4337 UserOp on Base mainnet; verifiable on
 *    BaseScan independent of Locus's API state
 *
 * If you change one of these records, change it here. There is no second copy.
 */

export interface AnchorDisbursement {
  /** UUID Locus assigned to the originating /pay/send call */
  locusTxId: string;
  /** Real Base-mainnet ERC-4337 UserOp hash, verifiable on BaseScan */
  txHash: string;
  amountUsdc: number;
  apr: number;
  termDays: number;
  agentId: number;
  toAddress: string;
  /** ISO-8601 timestamp of the original disbursement */
  createdAtIso: string;
}

export const ANCHOR_DISBURSEMENTS: AnchorDisbursement[] = [
  {
    locusTxId: '486e98b7-1dba-4977-aa4a-1ca7d01a1b67',
    txHash: '0x8d3af51d58b3011490ebbc4a0dd231110c63e11fab484cce4795938cbc679d3b',
    amountUsdc: 0.15,
    apr: 10,
    termDays: 1,
    agentId: 2,
    toAddress: '0x4d8df94a00d8f267ceed9eacbde905928b0afcd8',
    createdAtIso: '2026-04-14T14:38:00.000Z',
  },
  {
    locusTxId: '448f1c2e-2535-4b12-ba7e-11e680791ae5',
    txHash: '0x33e789fe819a4c497c1c7d429b37a93166c09ebe4aa3a963c624ad81c993b5b1',
    amountUsdc: 0.10,
    apr: 10,
    termDays: 1,
    agentId: 2,
    toAddress: '0x4d8df94a00d8f267ceed9eacbde905928b0afcd8',
    createdAtIso: '2026-04-14T15:43:54.000Z',
  },
  {
    locusTxId: '689ef4cd-2169-4838-8a31-e155d298ea39',
    txHash: '0x53490f8f27cc155616e6dea68278cb34055b523272b10e1b06dfdd24cad551ea',
    amountUsdc: 0.05,
    apr: 10,
    termDays: 1,
    agentId: 2,
    toAddress: '0x4d8df94a00d8f267ceed9eacbde905928b0afcd8',
    createdAtIso: '2026-04-14T15:47:28.000Z',
  },
];

/** Shape consumed by the GET /api/portfolio/disbursements endpoint */
export interface DisbursementRecord {
  id: string;
  amountUsdc: number;
  memo: string;
  toAddress: string;
  createdAt: string;
  txHash: string;
  basescanUrl: string;
}

/** Render an anchor as the dashboard-facing disbursement shape. */
export function asDisbursementRecord(a: AnchorDisbursement): DisbursementRecord {
  const memo = `LetAliceLead Loan (external): ${a.amountUsdc.toFixed(6)} USDC @ ${a.apr}% APR for ${a.termDays}d to agent #${a.agentId}`;
  return {
    id: `anchor-${a.txHash.slice(0, 10)}`,
    amountUsdc: a.amountUsdc,
    memo,
    toAddress: a.toAddress,
    createdAt: a.createdAtIso,
    txHash: a.txHash,
    basescanUrl: `https://basescan.org/tx/${a.txHash}`,
  };
}
