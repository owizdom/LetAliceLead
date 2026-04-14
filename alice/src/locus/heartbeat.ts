/**
 * Locus heartbeat + feedback — per the Locus skill doc:
 *  - POST /api/feedback with source="heartbeat" every 30 min to check in
 *  - POST /api/feedback with source="error" when a Locus call fails
 *  - Track state in ~/.config/locus/state.json
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger';

const API_BASE = process.env.LOCUS_API_BASE || 'https://beta-api.paywithlocus.com/api';
const HEARTBEAT_MS = 30 * 60 * 1000; // 30 minutes
const STATE_DIR = path.join(os.homedir(), '.config', 'locus');
const STATE_PATH = path.join(STATE_DIR, 'state.json');

interface LocusState {
  lastSkillUpdate?: string;
  lastFeedbackSubmission?: string;
  lastHeartbeatAt?: string;
  heartbeatCount?: number;
}

interface FeedbackBody {
  category: 'error' | 'general' | 'endpoint' | 'suggestion';
  message: string;
  source: 'error' | 'heartbeat' | 'manual';
  endpoint?: string;
  context?: Record<string, unknown>;
}

// In-memory counters for the next heartbeat summary
const activitySinceLastHeartbeat = {
  paySend: 0,
  payBalance: 0,
  wrappedCalls: {} as Record<string, number>,
  errors: [] as Array<{ endpoint: string; message: string }>,
};

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function readState(): LocusState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as LocusState;
    }
  } catch {
    // fall through
  }
  return {};
}

function writeState(state: LocusState): void {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    // non-fatal — Alice still runs if she can't persist
    logger.warn('locus.state.write_failed', { error: String(err) });
  }
}

async function postFeedback(body: FeedbackBody): Promise<void> {
  const key = process.env.LOCUS_API_KEY;
  if (!key) return;
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn('locus.feedback.http_error', { status: res.status });
    }
  } catch (err) {
    logger.warn('locus.feedback.network_error', { error: String(err) });
  }
}

// ─── Public API ──────────────────────────────────────────────

export function recordActivity(kind: 'pay.send' | 'pay.balance' | 'wrapped', provider?: string): void {
  if (kind === 'pay.send') activitySinceLastHeartbeat.paySend += 1;
  else if (kind === 'pay.balance') activitySinceLastHeartbeat.payBalance += 1;
  else if (kind === 'wrapped' && provider) {
    activitySinceLastHeartbeat.wrappedCalls[provider] =
      (activitySinceLastHeartbeat.wrappedCalls[provider] || 0) + 1;
  }
}

export function recordError(endpoint: string, message: string, context?: Record<string, unknown>): void {
  activitySinceLastHeartbeat.errors.push({ endpoint, message });
  void postFeedback({
    category: 'error',
    source: 'error',
    endpoint,
    message,
    context,
  });
}

export async function sendHeartbeat(): Promise<void> {
  const a = activitySinceLastHeartbeat;
  const wrappedSummary = Object.entries(a.wrappedCalls)
    .map(([p, n]) => `${p}/${n}`)
    .join(', ') || 'none';
  const parts = [
    `pay/send: ${a.paySend}`,
    `pay/balance: ${a.payBalance}`,
    `wrapped: ${wrappedSummary}`,
    `errors: ${a.errors.length}`,
  ];
  const message = `LetAliceLead heartbeat — ${parts.join(' · ')}`;

  await postFeedback({
    category: 'general',
    source: 'heartbeat',
    message,
    context: {
      paySend: a.paySend,
      payBalance: a.payBalance,
      wrappedCalls: { ...a.wrappedCalls },
      errorCount: a.errors.length,
    },
  });

  // Reset counters
  a.paySend = 0;
  a.payBalance = 0;
  a.wrappedCalls = {};
  a.errors = [];

  const state = readState();
  const now = new Date().toISOString();
  writeState({
    ...state,
    lastHeartbeatAt: now,
    lastFeedbackSubmission: now,
    heartbeatCount: (state.heartbeatCount || 0) + 1,
  });

  logger.info('locus.heartbeat.sent', { message });
}

export function startHeartbeatLoop(): void {
  if (heartbeatTimer) return;
  if (!process.env.LOCUS_API_KEY) {
    logger.warn('locus.heartbeat.skipped', { reason: 'No LOCUS_API_KEY configured' });
    return;
  }
  logger.info('locus.heartbeat.start', { intervalMs: HEARTBEAT_MS, statePath: STATE_PATH });
  heartbeatTimer = setInterval(() => {
    sendHeartbeat().catch((err) => logger.warn('locus.heartbeat.tick_failed', { error: String(err) }));
  }, HEARTBEAT_MS);
}

export function stopHeartbeatLoop(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
