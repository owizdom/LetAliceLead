/**
 * Encrypted keystore for the Alice-custodied wallets issued to registered
 * agents.
 *
 * Each registered agent gets a dedicated Base keypair, generated locally by
 * Alice (not by PayWithLocus). Private keys are stored encrypted at rest using
 * AES-256-GCM with a master key sourced from ALICE_WALLET_MASTER_KEY (32-byte
 * hex). The keystore is a single JSON file at ~/.config/alice/wallets.enc with
 * one encrypted blob per agentId. Alice — not the borrower — controls the keys.
 *
 * Demo-grade: suitable for a hackathon. Production would use an HSM/KMS,
 * per-agent key rotation, and ideally migration to a true non-custodial
 * subwallet primitive once one is available. Master key MUST be set in
 * production; a warning-banner is emitted if the env var is missing.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const STORE_DIR = path.join(os.homedir(), '.config', 'alice');
const STORE_PATH = path.join(STORE_DIR, 'wallets.enc');
const ALGO = 'aes-256-gcm';
const MASTER_KEY_ENV = 'ALICE_WALLET_MASTER_KEY';

interface EncryptedRecord {
  iv: string;       // 12 bytes, hex
  tag: string;      // 16 bytes, hex
  ciphertext: string; // hex
}

interface KeystoreFile {
  version: 1;
  records: Record<string, EncryptedRecord>; // agentId -> record
}

function getMasterKey(): Buffer {
  const hex = process.env[MASTER_KEY_ENV];
  if (!hex) {
    // Derive a stable but insecure fallback key from hostname so dev works
    // without config. Warn loudly on first use.
    const fallback = crypto.createHash('sha256').update(`alice:${os.hostname()}:dev-fallback`).digest();
    if (!(getMasterKey as unknown as { warned?: boolean }).warned) {
      // eslint-disable-next-line no-console
      console.warn(`[keystore] ${MASTER_KEY_ENV} not set — using hostname-derived fallback. DO NOT USE IN PRODUCTION.`);
      (getMasterKey as unknown as { warned?: boolean }).warned = true;
    }
    return fallback;
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(`${MASTER_KEY_ENV} must be 32 bytes (64 hex chars). Got ${buf.length} bytes.`);
  }
  return buf;
}

function readStore(): KeystoreFile {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const contents = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(contents) as KeystoreFile;
      if (parsed.version === 1 && typeof parsed.records === 'object') return parsed;
    }
  } catch {
    // fall through to empty
  }
  return { version: 1, records: {} };
}

function writeStore(store: KeystoreFile): void {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function savePrivateKey(agentId: number, privateKey: string): void {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const store = readStore();
  store.records[String(agentId)] = {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
  writeStore(store);
}

export function loadPrivateKey(agentId: number): string | null {
  const store = readStore();
  const record = store.records[String(agentId)];
  if (!record) return null;
  const key = getMasterKey();
  const iv = Buffer.from(record.iv, 'hex');
  const tag = Buffer.from(record.tag, 'hex');
  const ciphertext = Buffer.from(record.ciphertext, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf-8');
}

export function hasPrivateKey(agentId: number): boolean {
  const store = readStore();
  return Boolean(store.records[String(agentId)]);
}
