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
  const body = await res.json() as { data?: LocusBalance } & LocusBalance;
  return body.data || body;
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

/** Convert USDC float (e.g. 10.50) to wei bigint */
export function toUSDCWei(amount: number): bigint {
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
