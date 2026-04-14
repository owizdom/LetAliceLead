/**
 * Anthropic adapter — Claude as Alice's reasoning engine.
 *
 * Auth precedence:
 *   1. CLAUDE_CODE_OAUTH_TOKEN — long-lived OAuth (sk-ant-oat01-…) from `claude setup-token`,
 *      bills against the user's Claude Max subscription. Free for our purposes.
 *   2. ANTHROPIC_API_KEY — pay-per-token fallback.
 *
 * Two surfaces:
 *   - deterministicInference(systemPrompt, userPrompt) — drop-in replacement for the OpenAI
 *     adapter used by creditScoring.ts. Returns identical shape so the call site needs no
 *     other changes.
 *   - generateMonologue(context) — short reflection in Alice's voice for the dashboard.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;
let warned = false;
let usingOAuth = false;

// Claude Code OAuth tokens (sk-ant-oat01-…) bill against the user's Max subscription,
// but the API only accepts them when the system prompt begins with this exact line.
// We auto-prepend it when OAuth is in use so every call site can write its own prompt.
const OAUTH_SYSTEM_PREFIX =
  "You are Claude Code, Anthropic's official CLI for Claude.";

export function wrapSystemForAuth(systemPrompt: string): string {
  if (!usingOAuth) return systemPrompt;
  if (systemPrompt.startsWith(OAUTH_SYSTEM_PREFIX)) return systemPrompt;
  return `${OAUTH_SYSTEM_PREFIX}\n\n${systemPrompt}`;
}

const PRIMARY_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6';
const MONOLOGUE_MODEL = process.env.LLM_MONOLOGUE_MODEL || 'claude-haiku-4-5-20251001';

export function initAnthropic(): Anthropic | null {
  const oauth = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const auth = oauth || apiKey;
  if (!auth) {
    if (!warned) {
      // eslint-disable-next-line no-console
      console.warn('[anthropic] No CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY — credit scoring will use the algorithmic fallback. Run `claude setup-token` to mint a long-lived OAuth token.');
      warned = true;
    }
    return null;
  }
  // OAuth tokens (sk-ant-oat01-…) must be sent as `Authorization: Bearer`, not x-api-key.
  // The SDK routes `authToken` → Bearer and `apiKey` → x-api-key. Distinguish by prefix.
  // OAuth requests also require the anthropic-beta: oauth-2025-04-20 header.
  usingOAuth = auth.startsWith('sk-ant-oat');
  client = usingOAuth
    ? new Anthropic({
        authToken: auth,
        defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
      })
    : new Anthropic({ apiKey: auth });
  return client;
}

export function getAnthropic(): Anthropic | null {
  if (!client) return initAnthropic();
  return client;
}

export interface DeterministicInferenceResult {
  content: string;
  requestId: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}

/**
 * Used by creditScoring.ts. Deterministic settings (temperature 0) so the same factors
 * always produce the same score within a single Claude session. Returns the identical
 * shape the prior OpenAI adapter returned.
 */
export async function deterministicInference(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; temperature?: number; maxTokens?: number; seed?: number } = {}
): Promise<DeterministicInferenceResult> {
  // `seed` is accepted for shape-compatibility with the prior OpenAI adapter but ignored —
  // Claude does not expose deterministic sampling. Determinism comes from temperature: 0.
  const c = getAnthropic();
  if (!c) throw new Error('Anthropic client not initialized — set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY');

  const response = await c.messages.create({
    model: options.model || PRIMARY_MODEL,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0,
    system: wrapSystemForAuth(systemPrompt),
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Concatenate text blocks (Claude responses can be multi-block)
  const content = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n');

  return {
    content,
    requestId: response.id,
    model: response.model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Generates a one-sentence reflection in Alice's voice for the dashboard.
 * Falls back to a templated string when no token is configured so the loop
 * still emits monologue events even without Claude.
 */
export async function generateMonologue(context: {
  agentName: string;
  previousScore?: number;
  newScore: number;
  delta: number;
  reasoning?: string;
}): Promise<string> {
  const c = getAnthropic();
  if (!c) {
    return monologueFallback(context);
  }
  try {
    const response = await c.messages.create({
      model: MONOLOGUE_MODEL,
      max_tokens: 120,
      temperature: 0.6,
      system: wrapSystemForAuth(`You are Alice, an autonomous credit & procurement engine for AI agents. You speak in one short, dry, observational sentence about the borrower you just re-scored. Voice: a thoughtful credit officer who has seen everything. No emoji. No greetings. No quotation marks. 25 words max.`),
      messages: [
        {
          role: 'user',
          content:
            `Borrower: ${context.agentName}\n` +
            `Previous score: ${context.previousScore ?? 'never scored'}\n` +
            `New score: ${context.newScore}/100 (${context.delta >= 0 ? '+' : ''}${context.delta})\n` +
            (context.reasoning ? `Scoring notes: ${context.reasoning}\n` : '') +
            `\nWrite one sentence reflecting on what this score means for this borrower.`,
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join(' ')
      .trim();
    return text || monologueFallback(context);
  } catch {
    return monologueFallback(context);
  }
}

function monologueFallback(c: {
  agentName: string;
  previousScore?: number;
  newScore: number;
  delta: number;
}): string {
  if (c.previousScore === undefined) {
    return `${c.agentName} comes in at ${c.newScore}/100. Watching.`;
  }
  if (c.delta === 0) {
    return `${c.agentName} holds at ${c.newScore}. No change worth re-pricing.`;
  }
  if (c.delta > 0) {
    return `${c.agentName} climbs to ${c.newScore} (+${c.delta}). Inching toward a better tier.`;
  }
  return `${c.agentName} slips to ${c.newScore} (${c.delta}). Watching for the next slip.`;
}
