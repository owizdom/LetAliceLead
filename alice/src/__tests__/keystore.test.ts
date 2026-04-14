import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { savePrivateKey, loadPrivateKey, hasPrivateKey } from '../wallets/keystore';

const STORE_DIR = path.join(os.homedir(), '.config', 'alice');
const STORE_PATH = path.join(STORE_DIR, 'wallets.enc');

const TEST_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111';

describe('wallets keystore (AES-256-GCM)', () => {
  beforeAll(() => {
    process.env.ALICE_WALLET_MASTER_KEY =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  });

  afterAll(() => {
    // Best-effort cleanup of test entries (we share the keystore with dev)
    if (fs.existsSync(STORE_PATH)) {
      try {
        const content = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as { records: Record<string, unknown> };
        delete content.records['999999'];
        delete content.records['999998'];
        fs.writeFileSync(STORE_PATH, JSON.stringify(content, null, 2), 'utf-8');
      } catch {
        // ignore
      }
    }
  });

  it('encrypts and decrypts a private key roundtrip', () => {
    savePrivateKey(999999, TEST_KEY);
    expect(hasPrivateKey(999999)).toBe(true);
    expect(loadPrivateKey(999999)).toBe(TEST_KEY);
  });

  it('returns null for a non-existent agent', () => {
    expect(loadPrivateKey(424242)).toBeNull();
    expect(hasPrivateKey(424242)).toBe(false);
  });

  it('produces different ciphertexts for the same key (random IV per save)', () => {
    savePrivateKey(999998, TEST_KEY);
    const first = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    savePrivateKey(999998, TEST_KEY);
    const second = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    expect(first.records['999998'].iv).not.toBe(second.records['999998'].iv);
  });
});
