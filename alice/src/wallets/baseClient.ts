/**
 * Thin viem wrapper for Base mainnet USDC operations.
 *  - Create a random keypair
 *  - Read USDC balance at an address
 *  - Sign + broadcast a USDC ERC-20 transfer from a private key we hold
 *
 * USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals)
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, getContract } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

function getRpcUrl(): string {
  return process.env.BASE_RPC_URL || 'https://mainnet.base.org';
}

function publicClient() {
  return createPublicClient({ chain: base, transport: http(getRpcUrl()) });
}

export interface NewWallet {
  address: `0x${string}`;
  privateKey: `0x${string}`;
}

export function createWallet(): NewWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

export async function readUsdcBalance(address: `0x${string}`): Promise<number> {
  const client = publicClient();
  const contract = getContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    client,
  });
  const raw = (await contract.read.balanceOf([address])) as bigint;
  return Number(formatUnits(raw, USDC_DECIMALS));
}

export async function sendUsdc(
  privateKey: `0x${string}`,
  to: `0x${string}`,
  amountFloat: number
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(getRpcUrl()),
  });
  const amount = parseUnits(amountFloat.toFixed(USDC_DECIMALS), USDC_DECIMALS);
  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to, amount],
  });
  return hash;
}

export { USDC_ADDRESS, USDC_DECIMALS };
