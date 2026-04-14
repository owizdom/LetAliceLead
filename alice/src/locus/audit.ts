/**
 * Audit log — in-memory ring buffer + append-only JSONL on disk.
 *
 * Disk path: ALICE_AUDIT_PATH env, defaults to ~/.config/alice/audit.jsonl
 * (one JSON object per line). On boot we hydrate the in-memory ring from
 * the tail of the file so dashboards see a contiguous history across
 * restarts. Every write fires a fire-and-forget appendFile.
 *
 * Why JSONL not JSON: append-only, crash-safe, easy grep, never has to
 * rewrite the whole file. Loan store uses JSON because it's a small
 * working set; the audit log can grow to hundreds of MB and JSON would
 * choke.
 */

import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, appendFile } from 'fs';
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

const AUDIT_PATH = process.env.ALICE_AUDIT_PATH || join(homedir(), '.config', 'alice', 'audit.jsonl');
const MAX_IN_MEMORY = 10_000;
const HYDRATE_TAIL = 10_000;

const auditEntries: AuditEntry[] = [];

// Hydrate the in-memory ring from disk on module import. Best-effort —
// if the file is missing or corrupt, we start clean.
function hydrateFromDisk(): void {
  try {
    if (!existsSync(AUDIT_PATH)) return;
    const lines = readFileSync(AUDIT_PATH, 'utf8').split('\n').filter(Boolean);
    const tail = lines.slice(-HYDRATE_TAIL);
    for (const line of tail) {
      try {
        const e = JSON.parse(line) as AuditEntry;
        if (e && typeof e.timestamp === 'number' && typeof e.action === 'string') {
          auditEntries.push(e);
        }
      } catch {
        /* skip corrupt line */
      }
    }
  } catch {
    /* ignore */
  }
}
hydrateFromDisk();

function ensureDir(): void {
  try {
    mkdirSync(dirname(AUDIT_PATH), { recursive: true });
  } catch {
    /* ignore */
  }
}
ensureDir();

export async function auditLog(action: string, data: unknown): Promise<string | null> {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    action,
    data,
  };

  auditEntries.push(entry);

  // Trim in-memory ring; disk file is append-only and never truncated here
  if (auditEntries.length > MAX_IN_MEMORY) {
    auditEntries.splice(0, auditEntries.length - MAX_IN_MEMORY);
  }

  // Fire-and-forget JSONL append. Errors swallowed — losing one audit
  // line to a transient FS hiccup must not break the call site.
  appendFile(AUDIT_PATH, JSON.stringify(entry) + '\n', () => {});

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
