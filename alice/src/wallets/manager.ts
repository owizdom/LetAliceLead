/**
 * Public wallet API — issues and operates managed Base wallets for registered agents.
 */

import { createWallet, readUsdcBalance, sendUsdc } from './baseClient';
import { savePrivateKey, loadPrivateKey, hasPrivateKey } from './keystore';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';

export interface ManagedWallet {
  agentId: number;
  address: string;
}

// In-memory address cache so we don't decrypt to just read an address
const addressCache: Map<number, string> = new Map();

export function issueWallet(agentId: number): ManagedWallet {
  const existing = addressCache.get(agentId);
  if (existing && hasPrivateKey(agentId)) {
    return { agentId, address: existing };
  }
  const { address, privateKey } = createWallet();
  savePrivateKey(agentId, privateKey);
  addressCache.set(agentId, address);
  auditLog('wallet.issued', {
    agentId,
    address,
    chain: 'base',
    issuedAt: Date.now(),
  }).catch(() => {});
  logger.info('wallet.issued', { agentId, address }).catch(() => {});
  return { agentId, address };
}

export function getWalletAddress(agentId: number): string | null {
  const cached = addressCache.get(agentId);
  if (cached) return cached;
  if (!hasPrivateKey(agentId)) return null;
  try {
    const privateKey = loadPrivateKey(agentId);
    if (!privateKey) return null;
    // Recover address from key (avoid importing account at module scope)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { privateKeyToAccount } = require('viem/accounts');
    const account = privateKeyToAccount(privateKey);
    addressCache.set(agentId, account.address);
    return account.address;
  } catch {
    return null;
  }
}

export async function getWalletBalance(agentId: number): Promise<number> {
  const address = getWalletAddress(agentId);
  if (!address) return 0;
  try {
    return await readUsdcBalance(address as `0x${string}`);
  } catch (err) {
    logger.warn('wallet.balance.read_failed', { agentId, error: String(err) }).catch(() => {});
    return 0;
  }
}

export async function sweepTo(
  agentId: number,
  toAddress: string,
  amountFloat: number
): Promise<string | null> {
  const privateKey = loadPrivateKey(agentId);
  if (!privateKey) {
    logger.warn('wallet.sweep.no_key', { agentId }).catch(() => {});
    return null;
  }
  try {
    const hash = await sendUsdc(
      privateKey as `0x${string}`,
      toAddress as `0x${string}`,
      amountFloat
    );
    auditLog('wallet.sweep', {
      agentId,
      toAddress,
      amount: amountFloat,
      txHash: hash,
    }).catch(() => {});
    logger.info('wallet.sweep', { agentId, toAddress, amount: amountFloat, txHash: hash }).catch(() => {});
    return hash;
  } catch (err) {
    auditLog('wallet.sweep.failed', {
      agentId,
      toAddress,
      amount: amountFloat,
      error: String(err),
    }).catch(() => {});
    logger.error('wallet.sweep.failed', { agentId, error: String(err) }).catch(() => {});
    return null;
  }
}
