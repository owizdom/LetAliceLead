/**
 * Locus Adapter — Replaces all blockchain/ethers.js code with PayWithLocus API calls.
 * API Base: https://beta-api.paywithlocus.com/api
 * Auth: Bearer token (claw_xxx API key)
 */

const API_BASE = process.env.LOCUS_API_BASE || 'https://beta-api.paywithlocus.com/api';

function getApiKey(): string {
  const key = process.env.LOCUS_API_KEY;
  if (!key) throw new Error('LOCUS_API_KEY not set');
  return key;
}

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

// ─── Types ────────────────────────────────────────────────────

export interface LocusBalance {
  available: number;
  currency: string;
  walletAddress: string;
}

// What Locus actually returns from /pay/balance — snake_case, strings,
// a few fields the older LocusBalance interface doesn't capture.
interface LocusBalanceRaw {
  usdc_balance?: string | number;
  wallet_address?: string;
  chain?: string;
  allowance?: string | number | null;
  max_transaction_size?: string | number | null;
}

export interface LocusSendResult {
  transaction_id: string;
  status: string;
  from_address: string;
  to_address: string;
  amount: number;
}

export interface LocusTransaction {
  id: string;
  status: string;
  amount: number;
  from_address: string;
  to_address: string;
  memo?: string;
  created_at: string;
  category?: string;
}

export interface WrappedApiResponse<T = unknown> {
  success: boolean;
  data: T;
}

// ─── Core Payment Functions ───────────────────────────────────

export async function getBalance(): Promise<LocusBalance> {
  const res = await fetch(`${API_BASE}/pay/balance`, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    const { recordError } = await import('./heartbeat');
    recordError('/api/pay/balance', `${res.status} ${err.slice(0, 200)}`, { status_code: res.status });
    throw new Error(`Locus balance check failed (${res.status}): ${err}`);
  }
  const { recordActivity } = await import('./heartbeat');
  recordActivity('pay.balance');
  const body = await res.json() as { data?: LocusBalanceRaw } & LocusBalanceRaw;
  const raw: LocusBalanceRaw = body.data || body;
  // Locus returns usdc_balance as a string (e.g. "9.0"); coerce + fall back to 0.
  const availableNum = Number(raw.usdc_balance);
  return {
    available: Number.isFinite(availableNum) ? availableNum : 0,
    currency: 'USDC',
    walletAddress: raw.wallet_address || '',
  };
}

export async function sendPayment(params: {
  to_address: string;
  amount: number;
  memo: string;
}): Promise<LocusSendResult> {
  const res = await fetch(`${API_BASE}/pay/send`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    const { recordError } = await import('./heartbeat');
    recordError('/api/pay/send', `${res.status} ${err.slice(0, 200)}`, { status_code: res.status, amount: params.amount });
    throw new Error(`Locus send failed (${res.status}): ${err}`);
  }
  const { recordActivity } = await import('./heartbeat');
  recordActivity('pay.send');
  const body = await res.json() as { data?: LocusSendResult } & LocusSendResult;
  return body.data || body;
}

export async function getTransactions(opts: {
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
} = {}): Promise<LocusTransaction[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.status) params.set('status', opts.status);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);

  const url = `${API_BASE}/pay/transactions${params.toString() ? '?' + params : ''}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    const { recordError } = await import('./heartbeat');
    recordError('/api/pay/transactions', `${res.status} ${err.slice(0, 200)}`, { status_code: res.status });
    throw new Error(`Locus transactions failed (${res.status}): ${err}`);
  }
  const body = await res.json() as { data?: LocusTransaction[] } & { transactions?: LocusTransaction[] };
  return body.data || body.transactions || [];
}

/**
 * Look up the on-chain Base tx hash for a given Locus transaction id.
 * Returns undefined if the tx isn't found yet (Locus settlement is async)
 * or if the response shape doesn't expose a hash.
 */
export async function getOnChainHash(locusTxId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API_BASE}/pay/transactions?limit=20`, { headers: headers() });
    if (!res.ok) return undefined;
    const body = await res.json() as {
      data?: { transactions?: Array<{ id?: string; tx_hash?: string }> };
    };
    const txs = body.data?.transactions || [];
    const hit = txs.find((t) => t.id === locusTxId);
    return hit?.tx_hash || undefined;
  } catch {
    return undefined;
  }
}

// ─── Wrapped API Calls (Pay-Per-Use) ─────────────────────────

export async function wrappedCall<T = unknown>(
  provider: string,
  endpoint: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}/wrapped/${provider}/${endpoint}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const { recordActivity, recordError } = await import('./heartbeat');
  if (!res.ok) {
    const err = await res.text();
    recordError(`/api/wrapped/${provider}/${endpoint}`, `${res.status} ${err.slice(0, 200)}`, { status_code: res.status, provider });
    throw new Error(`Locus wrapped/${provider}/${endpoint} failed (${res.status}): ${err}`);
  }
  recordActivity('wrapped', provider);
  const result = await res.json() as WrappedApiResponse<T>;
  return result.data ?? (result as unknown as T);
}

// ─── Subwallets ───────────────────────────────────────────────
//
// Locus exposes `/pay/subwallets` for creating per-recipient scoped
// sub-accounts under a parent wallet. Alice uses these as per-agent
// "credit ceilings" — each registered borrower gets a dedicated
// subwallet with its own spending cap, making the Agent Credit Ceiling
// concept enforced by Locus policy rather than Alice's local code.
//
// Gated behind LOCUS_SUBWALLETS_ENABLED=true because the API is still
// beta — if the endpoint returns 404 we fall back to the Alice-custodied
// local keypair path (wallets/manager.ts) and log the degradation,
// rather than either failing agent registration or fabricating a
// subwallet id.

export interface LocusSubwallet {
  id: string;
  address: string;
  label: string;
  spending_cap_usdc?: number;
  balance_usdc?: number;
}

export function subwalletsEnabled(): boolean {
  return process.env.LOCUS_SUBWALLETS_ENABLED === 'true';
}

/**
 * Create a new scoped subwallet under Alice's Locus account.
 *
 * Throws on any non-2xx — callers must decide whether to propagate or fall
 * back (the typical flow falls back to a local keypair on 404 so that agent
 * registration is never blocked by a missing Locus primitive).
 */
export async function createSubwallet(opts: {
  label: string;
  spendingCapUsdc?: number;
}): Promise<LocusSubwallet> {
  const res = await fetch(`${API_BASE}/pay/subwallets`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      label: opts.label,
      ...(opts.spendingCapUsdc !== undefined ? { spending_cap_usdc: opts.spendingCapUsdc } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    const { recordError } = await import('./heartbeat');
    recordError('/api/pay/subwallets', `${res.status} ${err.slice(0, 200)}`, {
      status_code: res.status,
      label: opts.label,
    });
    throw new Error(`Locus createSubwallet failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const { recordActivity } = await import('./heartbeat');
  recordActivity('pay.subwallets.create');
  const body = (await res.json()) as { data?: LocusSubwallet } & LocusSubwallet;
  return body.data || body;
}

export async function listSubwallets(): Promise<LocusSubwallet[]> {
  const res = await fetch(`${API_BASE}/pay/subwallets`, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    const { recordError } = await import('./heartbeat');
    recordError('/api/pay/subwallets', `${res.status} ${err.slice(0, 200)}`, {
      status_code: res.status,
    });
    throw new Error(`Locus listSubwallets failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    data?: LocusSubwallet[];
    subwallets?: LocusSubwallet[];
  };
  return body.data || body.subwallets || [];
}

/**
 * Send USDC from a specific subwallet. Falls back to the root wallet via
 * sendPayment if the Locus API rejects the `from_subwallet_id` field (some
 * beta deployments haven't exposed the field yet) — the send still happens,
 * just not with subwallet-scoped enforcement. Every path returns a real
 * transaction_id or throws.
 */
export async function sendFromSubwallet(
  subwalletId: string,
  params: { to_address: string; amount: number; memo: string }
): Promise<LocusSendResult> {
  const res = await fetch(`${API_BASE}/pay/send`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...params, from_subwallet_id: subwalletId }),
  });
  if (res.status === 400 || res.status === 422) {
    // Beta API may reject `from_subwallet_id` as an unknown field. Surface
    // once, then fall back so disbursement is not blocked.
    const { recordError } = await import('./heartbeat');
    const errText = await res.text();
    recordError('/api/pay/send[subwallet]', `${res.status} ${errText.slice(0, 200)}`, {
      status_code: res.status,
      subwalletId,
      fallback: 'root_wallet',
    });
    return sendPayment(params);
  }
  if (!res.ok) {
    const err = await res.text();
    const { recordError } = await import('./heartbeat');
    recordError('/api/pay/send[subwallet]', `${res.status} ${err.slice(0, 200)}`, {
      status_code: res.status,
      subwalletId,
    });
    throw new Error(`Locus sendFromSubwallet failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const { recordActivity } = await import('./heartbeat');
  recordActivity('pay.send.subwallet');
  const body = (await res.json()) as { data?: LocusSendResult } & LocusSendResult;
  return body.data || body;
}

// ─── AgentMail ────────────────────────────────────────────────

export async function createMailInbox(username: string): Promise<{ address: string }> {
  return wrappedCall('agentmail', 'create-inbox', { username });
}

export async function sendMail(params: {
  inbox_id: string;
  to: string;
  subject: string;
  body: string;
}): Promise<unknown> {
  return wrappedCall('agentmail', 'send-message', params);
}

// ─── Convenience: USDC conversion ─────────────────────────────

const USDC_DECIMALS = 6;

/** Convert USDC float (e.g. 10.50) to wei bigint. Guards against NaN/Infinity. */
export function toUSDCWei(amount: number): bigint {
  if (!Number.isFinite(amount)) return 0n;
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

/** Convert wei bigint to USDC float */
export function fromUSDCWei(wei: bigint): number {
  return Number(wei) / 10 ** USDC_DECIMALS;
}

/** Get bank balance as bigint (wei) for treasury compatibility */
export async function getBankBalance(): Promise<{ balance: bigint; formatted: number }> {
  const bal = await getBalance();
  return {
    balance: toUSDCWei(bal.available),
    formatted: bal.available,
  };
}

/** Send USDC loan — accepts wei bigint, converts to float for Locus API */
export async function transferUSDC(toAddress: string, amountWei: bigint, memo: string): Promise<string> {
  const amountFloat = fromUSDCWei(amountWei);
  const result = await sendPayment({
    to_address: toAddress,
    amount: amountFloat,
    memo,
  });
  return result.transaction_id;
}

/** Verify a repayment by checking recent transactions from a specific address */
export async function verifyRepayment(
  fromAddress: string,
  minAmountWei: bigint
): Promise<{ verified: boolean; txId?: string; amount?: bigint }> {
  const txns = await getTransactions({ limit: 50, status: 'CONFIRMED' });
  const matching = txns.find(
    (tx) =>
      tx.from_address?.toLowerCase() === fromAddress.toLowerCase() &&
      toUSDCWei(tx.amount) >= minAmountWei
  );

  if (matching) {
    return { verified: true, txId: matching.id, amount: toUSDCWei(matching.amount) };
  }
  return { verified: false };
}

// ─── Init ─────────────────────────────────────────────────────

export function initLocus(): void {
  const key = process.env.LOCUS_API_KEY;
  if (!key) {
    console.warn('[Locus] No LOCUS_API_KEY set — API calls will fail');
    return;
  }
  console.log(`[Locus] Adapter initialized (API: ${API_BASE})`);
  console.log(`[Locus] Key: ${key.slice(0, 8)}...${key.slice(-4)}`);
}
