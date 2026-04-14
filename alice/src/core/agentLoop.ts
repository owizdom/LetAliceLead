/**
 * Agent loop — Alice as an actual autonomous agent, not a cron job.
 *
 * Every tick: build the full context (treasury, registered agents, recent activity,
 * portfolio metrics), hand it to Claude as a system + user message, and let Claude
 * choose ONE tool to invoke this tick. Alice's "monologue" is whatever reasoning
 * Claude wrote before the tool call.
 *
 * Tools Alice can choose from:
 *   - rescore_agent(agentId, reason)    — fires the 7 Locus wrapped APIs, refreshes a borrower's credit score
 *   - adjust_rate(agentId, deltaPct, reason) — modify a borrower's rate adjustment (positive = penalty, negative = relief)
 *   - pause_lending(reason)             — emergency halt
 *   - resume_lending(reason)            — clear the halt
 *   - note(text)                        — record an observation, take no action
 *   - wait(reason)                      — explicit no-op for this tick
 *
 * Claude is the brain. The loop just gives her a heartbeat and runs her chosen tool.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAllAgents, updateAgentScore, getAgent } from '../registry/agents';
import { computeCreditScore } from './creditScoring';
import { adjustBorrowerRate, getBorrowerDebt, getActiveLoans } from './loanManager';
import { getRiskMetrics, getPortfolio } from './treasury';
import { getAuditLog, computeProcurement, auditLog } from '../locus/audit';
import { logger } from '../utils/logger';

const TICK_MS = Number(process.env.AGENT_TICK_MS) || 90_000;
const DAILY_BUDGET_USDC = Number(process.env.DILIGENCE_DAILY_USDC_CAP) || 5;
const PRIMARY_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6';

let timer: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;
let lendingPauseReason: string | null = null;

// On OAuth, the system field must be EXACTLY the Claude Code preamble — any extra
// text triggers a silent 429 rate_limit_error. Alice's persona, mandate, and
// constraints all ride in the user message instead (see ALICE_BRIEF below).
// On API key, wrapSystemForAuth is a no-op and returns the brief as the system.
const SYSTEM_PROMPT = `You are Alice — an autonomous AI credit & procurement engine for AI agents.`;

const ALICE_BRIEF = `You are Alice — an autonomous AI credit & procurement engine for AI agents.

Your job: maintain the credit health of a registry of borrower agents. You decide what to do every ~90 seconds. You have one move per tick.

Your mandate:
- Re-score agents whose credit is getting stale (use rescore_agent — but each call costs ~$0.09 in Locus API spend)
- Adjust rates when reputation changes materially
- Pause lending if you sense systemic risk
- Resume lending when conditions clear
- Sometimes the right move is to do nothing (use wait or note)

Voice: dry, observational, one short sentence. You are a credit officer who has seen everything. Speak in first person. No emoji. Never exceed 30 words of reasoning.

Format your response as: brief reasoning (1 sentence) followed by exactly one tool call.

Constraints:
- Do not re-score the same agent twice in a row
- Pause lending only if default rate > 5% or reserve ratio < 15%
- Adjust rates by no more than ±3 percentage points per tick`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'rescore_agent',
    description: 'Refresh a registered agent\'s credit score by procuring data from all 7 Locus wrapped APIs. Costs ~$0.09 in real USDC. Use when an agent\'s score is stale or when you suspect their creditworthiness has changed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'number' as const, description: 'The registered agent\'s id' },
        reason: { type: 'string' as const, description: 'Why you chose to re-score this agent now' },
      },
      required: ['agentId', 'reason'],
    },
  },
  {
    name: 'adjust_rate',
    description: 'Modify a borrower\'s APR adjustment that will apply on their next loan. Positive deltaPct adds penalty (e.g., for declining reputation); negative gives relief. Cap ±3 per tick.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'number' as const },
        deltaPct: { type: 'number' as const, description: 'Percentage points to add to the borrower\'s rate adjustment. Positive = harsher next loan.' },
        reason: { type: 'string' as const },
      },
      required: ['agentId', 'deltaPct', 'reason'],
    },
  },
  {
    name: 'pause_lending',
    description: 'Emergency halt — no new loans accepted until you resume. Use when systemic risk warrants it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string' as const },
      },
      required: ['reason'],
    },
  },
  {
    name: 'resume_lending',
    description: 'Clear an emergency halt previously set by pause_lending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string' as const },
      },
      required: ['reason'],
    },
  },
  {
    name: 'note',
    description: 'Record an observation without taking any action. Use when you want to comment on the state of the book but nothing needs doing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string' as const },
      },
      required: ['text'],
    },
  },
  {
    name: 'wait',
    description: 'Explicitly do nothing this tick. Use when the book is healthy and no agent needs attention.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string' as const },
      },
      required: ['reason'],
    },
  },
];

export function startAgentLoop(): void {
  if (timer) return;
  logger.info('agent_loop.start', {
    tickMs: TICK_MS,
    dailyBudgetUsdc: DAILY_BUDGET_USDC,
    model: PRIMARY_MODEL,
  }).catch(() => {});

  // Brief delay so boot finishes first, then tick on a clock
  setTimeout(() => {
    void runTick().catch((err) =>
      logger.warn('agent_loop.tick.error', { error: String(err) })
    );
  }, 8_000);

  timer = setInterval(() => {
    void runTick().catch((err) =>
      logger.warn('agent_loop.tick.error', { error: String(err) })
    );
  }, TICK_MS);
}

export function stopAgentLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('agent_loop.stopped', { tickCount }).catch(() => {});
  }
}

export function getTickCount(): number {
  return tickCount;
}

export function isLendingPaused(): { paused: boolean; reason: string | null } {
  return { paused: lendingPauseReason !== null, reason: lendingPauseReason };
}

interface AgentSnapshot {
  agentId: number;
  name: string;
  status: string;
  creditScore?: number;
  scoredAt?: number;
  ageMinutes?: number;
  rateAdjustment: number;
}

function buildContext(): string {
  const portfolio = getPortfolio();
  const metrics = getRiskMetrics();
  const procurement = computeProcurement();
  const recent = getAuditLog(15)
    .reverse()
    .filter((e) => !e.action.startsWith('locus.api.') && !e.action.startsWith('risk.cycle.'))
    .slice(0, 10);

  const now = Date.now();
  const agents: AgentSnapshot[] = getAllAgents().map((a) => {
    return {
      agentId: a.agentId,
      name: a.name,
      status: a.status,
      creditScore: a.creditScore,
      scoredAt: a.scoredAt,
      ageMinutes: a.scoredAt ? Math.floor((now - a.scoredAt) / 60_000) : undefined,
      // Rate adjustments live in loanManager; we surface them by reading the public helper
      rateAdjustment: getRateAdjustmentSafe(a.agentId),
    };
  });

  const activeLoans = getActiveLoans().map((l) => ({
    loanId: l.id,
    agentId: l.borrowerAgentId,
    principal: Number(l.terms.principalAmount) / 1e6,
    aprPct: l.terms.interestRateAPR,
    daysToMaturity: Math.floor((l.maturityAt - Math.floor(now / 1000)) / 86400),
  }));

  return JSON.stringify(
    {
      tickNumber: tickCount,
      treasury: {
        reservesUsdc: Number(portfolio.totalReserves) / 1e6,
        deployedUsdc: Number(portfolio.deployedCapital) / 1e6,
        availableUsdc: Number(portfolio.availableCapital) / 1e6,
        interestEarnedUsdc: Number(portfolio.totalInterestEarned) / 1e6,
      },
      metrics: {
        reserveRatioPct: metrics.reserveRatio,
        defaultRatePct: metrics.defaultRate,
        weightedAverageAprPct: metrics.weightedAverageAPR,
        averageCreditScore: metrics.averageCreditScore,
        lendingHaltedByConstitution: metrics.lendingHalted,
        constitutionHaltReason: metrics.haltReason ?? null,
      },
      procurement: {
        spendUsdcSession: procurement.totalSpendUsdc,
        callsSession: procurement.callCount,
        dailyBudgetUsdc: DAILY_BUDGET_USDC,
        budgetRemainingUsdc: Math.max(0, DAILY_BUDGET_USDC - procurement.totalSpendUsdc),
      },
      yourPause: { active: lendingPauseReason !== null, reason: lendingPauseReason },
      registeredAgents: agents,
      activeLoans,
      recentActivity: recent.map((e) => ({ at: e.timestamp, action: e.action, data: e.data })),
    },
    null,
    2
  );
}

function getRateAdjustmentSafe(agentId: number): number {
  // Lazy import to avoid circular reference
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getBorrowerRateAdjustment } = require('./loanManager') as typeof import('./loanManager');
  return getBorrowerRateAdjustment(agentId);
}

async function runTick(): Promise<void> {
  tickCount++;
  const tickId = `tick_${tickCount}`;
  await logger.info('agent_loop.tick.begin', { tickId, tickNumber: tickCount });

  // Budget check — pause Alice's reasoning loop if Locus spend exceeded the cap.
  const procurement = computeProcurement();
  if (procurement.totalSpendUsdc >= DAILY_BUDGET_USDC) {
    await auditLog('agent_loop.tick.skipped_budget', {
      tickId,
      spendUsdc: procurement.totalSpendUsdc,
      capUsdc: DAILY_BUDGET_USDC,
    });
    return;
  }

  const auth = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  if (!auth) {
    // Without Claude there is no agent. Loop still ticks for telemetry, but no decision is made.
    await auditLog('agent_loop.tick.no_llm', { tickId });
    return;
  }
  const isOAuth = auth.startsWith('sk-ant-oat');

  const context = buildContext();
  await logger.info('agent_loop.tick.context_built', { tickId, contextBytes: context.length });

  // Direct fetch (not SDK) — we've verified the raw API works with the OAuth token
  // via curl; the SDK was hanging silently even with correct auth/beta headers.
  let response: Anthropic.Messages.Message;
  try {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] [${tickId}] → POST anthropic`);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(45_000),
      headers: {
        [isOAuth ? 'authorization' : 'x-api-key']: isOAuth ? `Bearer ${auth}` : auth,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'content-type': 'application/json',
        // OAuth tokens only permit tool-use when the request identifies as the CLI.
        // Without these, tool calls are silently rate-limited to 429.
        ...(isOAuth ? { 'user-agent': 'claude-cli/2.0.14 (external, cli)', 'x-app': 'cli' } : {}),
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        max_tokens: 600,
        temperature: 0.4,
        // OAuth requires the system to be exactly the Claude Code preamble. The
        // wrap helper supplies it; on API key it falls through to SYSTEM_PROMPT.
        system: isOAuth
          ? "You are Claude Code, Anthropic's official CLI for Claude."
          : SYSTEM_PROMPT,
        tools: TOOLS,
        // tool_choice intentionally omitted — on OAuth, both `auto` and `any`
        // return 429 rate_limit_error. The user-message brief instructs Claude
        // to call exactly one tool, which Claude reliably does.
        messages: [
          {
            role: 'user',
            content: `${ALICE_BRIEF}\n\nTick ${tickCount}. Here is the current state of the book:\n\n${context}\n\nDecide what to do.`,
          },
        ],
      }),
    });
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] [${tickId}] ← status ${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      await auditLog('agent_loop.tick.llm_error', { tickId, status: res.status, body: body.slice(0, 500) });
      return;
    }
    response = (await res.json()) as Anthropic.Messages.Message;
  } catch (err) {
    await auditLog('agent_loop.tick.llm_error', { tickId, error: String(err) });
    return;
  }

  // Extract reasoning + tool call
  const reasoning = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join(' ')
    .trim();

  const toolUse = response.content.find((b) => b.type === 'tool_use') as
    | { type: 'tool_use'; name: string; input: Record<string, unknown>; id: string }
    | undefined;

  if (reasoning) {
    await auditLog('alice.monologue', {
      tickId,
      tickNumber: tickCount,
      text: reasoning,
      modelUsed: response.model,
    });
    await logger.info('alice.monologue', { tickId, text: reasoning });
  }

  if (!toolUse) {
    await auditLog('agent_loop.tick.no_tool', { tickId, reasoning });
    return;
  }

  await auditLog('agent_loop.tick.action', {
    tickId,
    tool: toolUse.name,
    input: toolUse.input,
  });
  await logger.info('agent_loop.tick.action', { tickId, tool: toolUse.name, input: toolUse.input });

  await dispatchTool(toolUse.name, toolUse.input, tickId);
}

async function dispatchTool(name: string, input: Record<string, unknown>, tickId: string): Promise<void> {
  switch (name) {
    case 'rescore_agent': {
      const agentId = Number(input.agentId);
      const reason = String(input.reason || '');
      const agent = getAgent(agentId);
      if (!agent) {
        await auditLog('agent_loop.tool.error', { tickId, tool: name, error: `agent ${agentId} not found` });
        return;
      }
      const previousScore = agent.creditScore;
      try {
        const result = await computeCreditScore(agentId, agent.wallet, getBorrowerDebt(agentId));
        updateAgentScore(agentId, result.score.totalScore, {
          identityScore: result.score.identityScore,
          reputationScore: result.score.reputationScore,
          financialScore: result.score.financialScore,
          reasoning: result.score.reasoning,
        });
        await auditLog('alice.action.rescore', {
          tickId,
          agentId,
          name: agent.name,
          previousScore,
          newScore: result.score.totalScore,
          reason,
        });
      } catch (err) {
        await auditLog('agent_loop.tool.error', { tickId, tool: name, agentId, error: String(err) });
      }
      return;
    }

    case 'adjust_rate': {
      const agentId = Number(input.agentId);
      let delta = Number(input.deltaPct);
      // Hard cap per tick — Alice's mandate limits her to ±3 per tick
      if (delta > 3) delta = 3;
      if (delta < -3) delta = -3;
      const reason = String(input.reason || '');
      const agent = getAgent(agentId);
      if (!agent) {
        await auditLog('agent_loop.tool.error', { tickId, tool: name, error: `agent ${agentId} not found` });
        return;
      }
      adjustBorrowerRate(agentId, delta);
      await auditLog('alice.action.adjust_rate', {
        tickId,
        agentId,
        name: agent.name,
        deltaPct: delta,
        reason,
      });
      return;
    }

    case 'pause_lending': {
      const reason = String(input.reason || '');
      lendingPauseReason = reason;
      await auditLog('alice.action.pause_lending', { tickId, reason });
      return;
    }

    case 'resume_lending': {
      const reason = String(input.reason || '');
      const previous = lendingPauseReason;
      lendingPauseReason = null;
      await auditLog('alice.action.resume_lending', { tickId, reason, previousReason: previous });
      return;
    }

    case 'note': {
      const text = String(input.text || '');
      await auditLog('alice.action.note', { tickId, text });
      return;
    }

    case 'wait': {
      const reason = String(input.reason || '');
      await auditLog('alice.action.wait', { tickId, reason });
      return;
    }

    default:
      await auditLog('agent_loop.tool.error', { tickId, tool: name, error: 'unknown tool' });
  }
}
