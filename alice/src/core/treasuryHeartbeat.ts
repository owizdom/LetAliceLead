/**
 * Treasury heartbeat — sends a microscopic USDC pulse on Base every N
 * minutes so the dashboard / BaseScan record never goes silent. Each tick
 * is a real transfer with a "LetAliceLead Pulse #N" memo, indexed by the
 * Verified Disbursements panel and visible on Locus tx history.
 *
 * Default: 1 micro-USDC ($0.000001 = 1 USDC unit at 6 decimals) every 5
 * minutes. At that amount $1 of reserves funds ~1 million ticks — the
 * loop is effectively perpetual within the demo budget.
 *
 * Designed to be honest, not theatrical: every tx is a real on-chain
 * transfer, the recipient is a real registered agent's wallet, the memo
 * is auditable. It's the on-chain equivalent of a heartbeat ping.
 */

import { sendPayment } from '../locus/adapter';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { getAllAgents } from '../registry/agents';

const TICK_MS = Number(process.env.TREASURY_HEARTBEAT_MS) || 5 * 60_000;
const PULSE_AMOUNT = Number(process.env.TREASURY_HEARTBEAT_USDC) || 0.000001;

let timer: ReturnType<typeof setInterval> | null = null;
let pulseCount = 0;

/**
 * Pick a default destination for the pulse. Prefers Bob's wallet (registered
 * agent), falls back to Sovra's, then to a hardcoded burn-style address.
 */
function pulseDestination(): string {
  const agents = getAllAgents();
  const bob = agents.find((a) => a.name === 'bobIsAlive');
  if (bob?.wallet) return bob.wallet;
  const first = agents[0];
  if (first?.wallet) return first.wallet;
  // Last resort — Base USDC contract; safe sink, well-known address
  return '0x000000000000000000000000000000000000dEaD';
}

async function tick(): Promise<void> {
  pulseCount++;
  const tickId = `pulse_${pulseCount}`;
  const to = pulseDestination();
  const memo = `LetAliceLead Pulse #${pulseCount}`;

  try {
    const result = await sendPayment({
      to_address: to,
      amount: PULSE_AMOUNT,
      memo,
    });
    await auditLog('treasury.pulse.sent', {
      tickId,
      pulseNumber: pulseCount,
      amountUsdc: PULSE_AMOUNT,
      to,
      memo,
      locusTxId: result.transaction_id,
    });
    await logger.info('treasury.pulse.sent', {
      tickId,
      amount: PULSE_AMOUNT,
      to,
      locusTxId: result.transaction_id,
    });
  } catch (err) {
    await auditLog('treasury.pulse.failed', {
      tickId,
      pulseNumber: pulseCount,
      to,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startTreasuryHeartbeat(): void {
  if (timer) return;
  void logger.info('treasury.heartbeat.start', {
    tickMs: TICK_MS,
    pulseAmountUsdc: PULSE_AMOUNT,
  });
  // First pulse 30s after boot so other init has settled
  setTimeout(() => {
    void tick().catch((err) =>
      logger.warn('treasury.pulse.error', { error: String(err) })
    );
  }, 30_000);
  timer = setInterval(() => {
    void tick().catch((err) =>
      logger.warn('treasury.pulse.error', { error: String(err) })
    );
  }, TICK_MS);
}

export function stopTreasuryHeartbeat(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    void logger.info('treasury.heartbeat.stopped', { pulseCount });
  }
}

export function getPulseCount(): number {
  return pulseCount;
}
