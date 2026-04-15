/**
 * Public wallet API — issues and operates per-agent Base wallets.
 *
 * Two issuance paths, selected by the LOCUS_SUBWALLETS_ENABLED env flag:
 *
 *   (A) Locus subwallet path [LOCUS_SUBWALLETS_ENABLED=true] — Alice calls
 *       POST /pay/subwallets to create a scoped sub-account under her parent
 *       wallet. The subwallet has a Locus-enforced spending cap that makes
 *       the "Agent Credit Ceiling" concept real rather than just local. This
 *       is the non-custodial path: the key material lives with Locus, not in
 *       Alice's filesystem.
 *
 *   (B) Alice-custodied keystore path [default] — Alice generates a fresh
 *       viem keypair locally (see baseClient.createWallet) and persists it
 *       encrypted via keystore.ts. Alice holds the private key, the borrower
 *       does not. This is the legacy path; preserved as a fallback so that
 *       agent registration never hard-fails when Locus's beta subwallet API
 *       is unreachable.
 *
 * Both paths return the same ManagedWallet shape so callers don't branch.
 * The `subwalletId` field is only populated on path (A).
 */

import { createWallet, readUsdcBalance, sendUsdc } from './baseClient';
import { savePrivateKey, loadPrivateKey, hasPrivateKey } from './keystore';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { createSubwallet, subwalletsEnabled } from '../locus/adapter';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

export interface ManagedWallet {
  agentId: number;
  address: string;
  /** Present only when wallet was issued as a Locus subwallet. */
  subwalletId?: string;
  /** Locus-enforced spending cap in USDC, when applicable. */
  spendingCapUsdc?: number;
}

// In-memory address cache so we don't decrypt to just read an address
const addressCache: Map<number, string> = new Map();

// Persistent subwallet registry — maps agentId → { subwalletId, address, label }.
// Kept in a small JSON file alongside the loan ledger so reboot doesn't forget
// which Locus subwallet belongs to which agent.
interface SubwalletRecord {
  agentId: number;
  subwalletId: string;
  address: string;
  label: string;
  spendingCapUsdc?: number;
  createdAtIso: string;
}

const SUBWALLET_STORE_PATH =
  process.env.ALICE_SUBWALLET_STORE_PATH ||
  join(homedir(), '.config', 'alice', 'subwallets.json');

function loadSubwalletStore(): Map<number, SubwalletRecord> {
  try {
    if (!existsSync(SUBWALLET_STORE_PATH)) return new Map();
    const raw = readFileSync(SUBWALLET_STORE_PATH, 'utf8');
    const arr = JSON.parse(raw) as SubwalletRecord[];
    return new Map(arr.map((r) => [r.agentId, r]));
  } catch {
    return new Map();
  }
}

const subwalletStore: Map<number, SubwalletRecord> = loadSubwalletStore();

function saveSubwalletStore(): void {
  try {
    mkdirSync(join(homedir(), '.config', 'alice'), { recursive: true });
    writeFileSync(
      SUBWALLET_STORE_PATH,
      JSON.stringify([...subwalletStore.values()], null, 2),
      'utf8'
    );
  } catch (err) {
    logger.warn('subwallet.persist.failed', { error: String(err) }).catch(() => {});
  }
}

/** Read-only lookup for loanManager and dashboard. */
export function getSubwallet(agentId: number): SubwalletRecord | undefined {
  return subwalletStore.get(agentId);
}

/**
 * Synchronous legacy path — issues an Alice-custodied keypair. Preserved for
 * callers that cannot await (historical ones already migrated).
 */
export function issueWallet(agentId: number): ManagedWallet {
  // Fast-path: agent already has a subwallet on record — return it.
  const sub = subwalletStore.get(agentId);
  if (sub) {
    addressCache.set(agentId, sub.address);
    return {
      agentId,
      address: sub.address,
      subwalletId: sub.subwalletId,
      spendingCapUsdc: sub.spendingCapUsdc,
    };
  }

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
    mode: 'local_keystore',
    issuedAt: Date.now(),
  }).catch(() => {});
  logger.info('wallet.issued', { agentId, address, mode: 'local_keystore' }).catch(() => {});
  return { agentId, address };
}

/**
 * Async issuance — prefers Locus subwallet creation when LOCUS_SUBWALLETS_ENABLED
 * is set, otherwise delegates to the synchronous local-keystore path. Idempotent:
 * re-issuing for an agent that already has a subwallet returns the stored record.
 *
 * `label` defaults to `agent-${agentId}` but should include the agent's display
 * name for readability in the Locus dashboard. `spendingCapUsdc` becomes the
 * Locus-enforced ceiling on this borrower's credit line.
 */
export async function issueWalletAsync(
  agentId: number,
  opts: { label?: string; spendingCapUsdc?: number } = {}
): Promise<ManagedWallet> {
  const existing = subwalletStore.get(agentId);
  if (existing) {
    addressCache.set(agentId, existing.address);
    return {
      agentId,
      address: existing.address,
      subwalletId: existing.subwalletId,
      spendingCapUsdc: existing.spendingCapUsdc,
    };
  }

  if (subwalletsEnabled()) {
    const label = (opts.label || `agent-${agentId}`).slice(0, 48);
    try {
      const sub = await createSubwallet({
        label,
        spendingCapUsdc: opts.spendingCapUsdc,
      });
      const record: SubwalletRecord = {
        agentId,
        subwalletId: sub.id,
        address: sub.address,
        label,
        spendingCapUsdc: opts.spendingCapUsdc,
        createdAtIso: new Date().toISOString(),
      };
      subwalletStore.set(agentId, record);
      saveSubwalletStore();
      addressCache.set(agentId, sub.address);

      await auditLog('wallet.issued', {
        agentId,
        address: sub.address,
        subwalletId: sub.id,
        chain: 'base',
        mode: 'locus_subwallet',
        label,
        spendingCapUsdc: opts.spendingCapUsdc,
        issuedAt: Date.now(),
      });
      await logger.info('wallet.issued', {
        agentId,
        address: sub.address,
        subwalletId: sub.id,
        mode: 'locus_subwallet',
      });
      return {
        agentId,
        address: sub.address,
        subwalletId: sub.id,
        spendingCapUsdc: opts.spendingCapUsdc,
      };
    } catch (err) {
      // Locus subwallet API unreachable / rejected — fall back to the local
      // keystore path so registration still succeeds. The fallback is audited
      // so the degradation is visible in the dashboard, not silent.
      await auditLog('wallet.subwallet.fallback', {
        agentId,
        error: String(err).slice(0, 200),
        fallback: 'local_keystore',
      });
      await logger.warn('wallet.subwallet.fallback', {
        agentId,
        error: String(err).slice(0, 200),
      });
    }
  }

  return issueWallet(agentId);
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
