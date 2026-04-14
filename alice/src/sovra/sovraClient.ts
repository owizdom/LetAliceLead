/**
 * Sovra vendor integration — Alice bids real USDC on Sovra's auction
 * (sovra.dev) for sponsored attention. Three-step flow per
 * Gajesh's `Gajesh2007/sovra` repo (`frontend/src/hooks/useBaseBid.ts`):
 *
 *   1. USDC.approve(CartoonistAuction, amountUsdc * 1e6) — Base ERC20
 *   2. CartoonistAuction.placeBid(amountUsdc) — pulls USDC into escrow
 *   3. POST /api/auction/request { bidder, requestText } — registers the
 *      human-readable request that Sovra's agent will publish if Alice wins
 *
 * Alice's bid wallet is a self-custodial keypair held in env (separate from
 * her Locus-managed bank wallet, which can't sign arbitrary contract calls).
 * If env keys are missing or the wallet is unfunded, we fall back to
 * intent-only logging plus the unauthenticated request POST so the demo
 * still records what Alice would have bid.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';

const USDC_ADDRESS: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const CARTOONIST_AUCTION: Address = '0xCCb82a48C1Ce547988affa0ac4312aa6CAf4F142';
const USDC_DECIMALS = 6;
const SOVRA_API = process.env.SOVRA_API_BASE || 'https://www.sovra.dev';
const MIN_GAS_WEI = 50_000_000_000_000n; // 0.00005 ETH — rough floor for two txs

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const AUCTION_ABI = [
  {
    type: 'function',
    name: 'placeBid',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amountUsdc', type: 'uint256' }],
    outputs: [],
  },
] as const;

function getRpc(): string {
  return process.env.BASE_RPC_URL || 'https://mainnet.base.org';
}

function pub() {
  return createPublicClient({ chain: base, transport: http(getRpc()) });
}

export interface SovraBidResult {
  /** "onchain" if the EVM bid landed, "intent" if we only POSTed the request */
  mode: 'onchain' | 'intent';
  approveTxHash?: `0x${string}`;
  bidTxHash?: `0x${string}`;
  requestPosted?: boolean;
  reason?: string;
}

/**
 * POST the request text to Sovra's unauthenticated request endpoint. This
 * is a no-op for the auction itself (Sovra's agent won't publish without an
 * on-chain bid) but records Alice's intent in their system + ours.
 */
async function postRequest(bidder: string, requestText: string): Promise<boolean> {
  try {
    const res = await fetch(`${SOVRA_API}/api/auction/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidder, requestText }),
    });
    if (!res.ok) {
      await logger.warn('sovra.request.post_failed', {
        status: res.status,
        body: (await res.text()).slice(0, 200),
      });
      return false;
    }
    return true;
  } catch (err) {
    await logger.warn('sovra.request.post_error', { error: String(err) });
    return false;
  }
}

export async function placeBid(
  usdcAmount: number,
  requestText: string
): Promise<SovraBidResult> {
  const pk = process.env.SOVRA_BID_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) {
    await auditLog('sovra.bid.intent', {
      reason: 'no_bid_wallet_configured',
      usdcAmount,
      requestText,
    });
    const posted = await postRequest('0x0000000000000000000000000000000000000000', requestText);
    return { mode: 'intent', requestPosted: posted, reason: 'no_bid_wallet' };
  }

  const account = privateKeyToAccount(pk);
  const bidder = account.address;
  const client = pub();

  // Pre-flight: balance + gas
  const [usdcBal, ethBal] = await Promise.all([
    client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [bidder],
    }),
    client.getBalance({ address: bidder }),
  ]);

  const requiredUsdc = parseUnits(usdcAmount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
  if (usdcBal < requiredUsdc) {
    await auditLog('sovra.bid.intent', {
      reason: 'insufficient_usdc_in_bid_wallet',
      bidder,
      have: Number(formatUnits(usdcBal, USDC_DECIMALS)),
      need: usdcAmount,
      usdcAmount,
      requestText,
    });
    const posted = await postRequest(bidder, requestText);
    return { mode: 'intent', requestPosted: posted, reason: 'insufficient_usdc' };
  }
  if (ethBal < MIN_GAS_WEI) {
    await auditLog('sovra.bid.intent', {
      reason: 'insufficient_gas',
      bidder,
      ethBalanceWei: ethBal.toString(),
      usdcAmount,
      requestText,
    });
    const posted = await postRequest(bidder, requestText);
    return { mode: 'intent', requestPosted: posted, reason: 'insufficient_gas' };
  }

  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(getRpc()),
  });

  // 1. approve
  const approveTxHash = await wallet.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CARTOONIST_AUCTION, requiredUsdc],
  });
  await client.waitForTransactionReceipt({ hash: approveTxHash });

  // 2. placeBid — contract takes whole USDC units (no decimals)
  const bidTxHash = await wallet.writeContract({
    address: CARTOONIST_AUCTION,
    abi: AUCTION_ABI,
    functionName: 'placeBid',
    args: [BigInt(Math.floor(usdcAmount))],
  });
  await client.waitForTransactionReceipt({ hash: bidTxHash });

  // 3. POST request text so Sovra's agent indexes the bid
  const requestPosted = await postRequest(bidder, requestText);

  await auditLog('sovra.bid.placed', {
    bidder,
    usdcAmount,
    requestText,
    approveTxHash,
    bidTxHash,
    requestPosted,
  });

  return {
    mode: 'onchain',
    approveTxHash,
    bidTxHash,
    requestPosted,
  };
}
