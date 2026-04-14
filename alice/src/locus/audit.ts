/**
 * In-memory audit log — replaces EigenDA.
 * Provides the same interface but stores everything locally.
 */

import { getApiCost } from './pricing';

interface AuditEntry {
  timestamp: number;
  action: string;
  data: unknown;
}

export interface ProcurementSummary {
  totalSpendUsdc: number;
  callCount: number;
  byProvider: Record<string, { calls: number; spendUsdc: number; usdcPerCall: number }>;
}

const auditEntries: AuditEntry[] = [];

export async function auditLog(action: string, data: unknown): Promise<string | null> {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    action,
    data,
  };

  auditEntries.push(entry);

  // Keep last 10000 entries
  if (auditEntries.length > 10000) {
    auditEntries.splice(0, auditEntries.length - 10000);
  }

  return null;
}

export function getAuditLog(limit = 100): AuditEntry[] {
  return auditEntries.slice(-limit);
}

export interface MonologueEntry {
  text: string;
  agentName?: string;
  agentId?: number;
  timestamp: number;
}

/**
 * Returns the most recent alice.monologue audit event as a structured snippet
 * for the dashboard. Returns null if no monologue has been generated yet.
 */
export function getMostRecentMonologue(): MonologueEntry | null {
  for (let i = auditEntries.length - 1; i >= 0; i--) {
    const entry = auditEntries[i];
    if (entry.action !== 'alice.monologue') continue;
    const data = (entry.data as Record<string, unknown>) || {};
    const text = typeof data.text === 'string' ? data.text : undefined;
    if (!text) continue;
    return {
      text,
      agentName: typeof data.agentName === 'string' ? data.agentName : undefined,
      agentId: typeof data.agentId === 'number' ? data.agentId : undefined,
      timestamp: entry.timestamp,
    };
  }
  return null;
}

/**
 * Aggregates wrapped-API call audit events into a procurement summary —
 * total USDC Alice has paid Locus providers, broken out per provider.
 * Surfaces the "agents trading API calls" loop on the dashboard.
 */
export function computeProcurement(): ProcurementSummary {
  const byProvider: ProcurementSummary['byProvider'] = {};
  let totalSpendUsdc = 0;
  let callCount = 0;

  for (const entry of auditEntries) {
    const match = /^locus\.api\.([^.]+)\.called$/.exec(entry.action);
    if (!match) continue;
    const provider = match[1];
    const cost = getApiCost(provider);
    if (!byProvider[provider]) {
      byProvider[provider] = { calls: 0, spendUsdc: 0, usdcPerCall: cost };
    }
    byProvider[provider].calls += 1;
    byProvider[provider].spendUsdc += cost;
    totalSpendUsdc += cost;
    callCount += 1;
  }

  return { totalSpendUsdc, callCount, byProvider };
}
