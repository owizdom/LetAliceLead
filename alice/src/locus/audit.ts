/**
 * In-memory audit log — replaces EigenDA.
 * Provides the same interface but stores everything locally.
 */

interface AuditEntry {
  timestamp: number;
  action: string;
  data: unknown;
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
