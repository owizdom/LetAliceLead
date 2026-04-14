import { AuditEntry } from "./api";

export type Mood = "watching" | "thinking" | "deciding" | "paused";

const MOOD_LABEL: Record<Mood, string> = {
  watching: "Reading the loan book",
  thinking: "Reasoning…",
  deciding: "Just decided",
  paused: "Lending paused",
};

const MOOD_VERB: Record<Mood, string> = {
  watching: "watching the book",
  thinking: "thinking",
  deciding: "deciding",
  paused: "paused lending",
};

// Phrases used after the "Alice " word in the AliceFace headline. Each
// reads naturally; some include "is", some don't (so "Alice just decided"
// works without grammar gymnastics).
const MOOD_PHRASE: Record<Mood, string> = {
  watching: "is reading her loan book",
  thinking: "is reasoning…",
  deciding: "just decided",
  paused: "paused lending",
};

export function moodPhrase(m: Mood): string {
  return MOOD_PHRASE[m];
}

const TOOL_VERB: Record<string, string> = {
  rescore_agent: "rescored",
  adjust_rate: "adjusted a rate for",
  pause_lending: "paused lending",
  resume_lending: "resumed lending",
  note: "noted",
  wait: "watched",
};

/**
 * Single source of truth for Alice's mood. Used by AliceCore (orb color +
 * status text) and IdentityBar (status pill).
 *
 * - `paused` if the operator/Alice halted lending
 * - `thinking` immediately after a tick.begin and before tick.action lands
 * - `deciding` for ~6s after tick.action (her chosen tool just executed)
 * - `watching` otherwise (idle between ticks)
 */
export function deriveMood(audit: AuditEntry[], paused: boolean, now = Date.now()): Mood {
  if (paused) return "paused";
  const lastBegin = audit.find((e) => e.action === "agent_loop.tick.begin");
  const lastAction = audit.find((e) => e.action === "agent_loop.tick.action");
  if (lastBegin && (!lastAction || lastBegin.timestamp > lastAction.timestamp)) {
    if (now - lastBegin.timestamp < 30_000) return "thinking";
  }
  if (lastAction && now - lastAction.timestamp < 6_000) return "deciding";
  return "watching";
}

export function moodLabel(m: Mood): string {
  return MOOD_LABEL[m];
}

export function moodVerb(m: Mood): string {
  return MOOD_VERB[m];
}

export interface LastDecision {
  tool: string;
  verb: string;
  agentName?: string;
  agentId?: number;
  reason?: string;
  timestamp: number;
}

export function deriveLastDecision(audit: AuditEntry[]): LastDecision | null {
  const tickAction = audit.find((e) => e.action === "agent_loop.tick.action");
  if (!tickAction) return null;
  const data = tickAction.data as { tool?: string; input?: Record<string, unknown> };
  const tool = String(data.tool || "");
  const verb = TOOL_VERB[tool] || tool;
  const input = (data.input || {}) as Record<string, unknown>;

  // Pull the matching alice.action.* entry for richer context (agent name)
  const aliceAction = audit.find(
    (e) => e.action.startsWith("alice.action.") && e.timestamp >= tickAction.timestamp - 1000
  );
  const aliceData = (aliceAction?.data as Record<string, unknown> | undefined) || {};

  return {
    tool,
    verb,
    agentName: typeof aliceData.name === "string" ? aliceData.name : undefined,
    agentId: typeof input.agentId === "number" ? input.agentId : undefined,
    reason: typeof input.reason === "string" ? input.reason : undefined,
    timestamp: tickAction.timestamp,
  };
}

export function timeAgo(ts: number, now = Date.now()): string {
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 60) return `${Math.max(0, sec)}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function deriveTickNumber(audit: AuditEntry[]): number {
  const last = audit.find((e) => e.action === "agent_loop.tick.begin");
  if (!last) return 0;
  return Number((last.data as { tickNumber?: number }).tickNumber) || 0;
}

export function deriveTickProgress(audit: AuditEntry[], tickMs = 90_000, now = Date.now()): number {
  const last = audit.find((e) => e.action === "agent_loop.tick.action") ||
    audit.find((e) => e.action === "agent_loop.start");
  if (!last) return 0;
  const elapsed = now - last.timestamp;
  return Math.min(100, Math.max(0, (elapsed / tickMs) * 100));
}
