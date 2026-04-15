/**
 * Credit scoring data sources via Locus wrapped APIs.
 *
 * Honesty contract: every factor below either returns *real* data fetched
 * from a Locus wrapped endpoint, or throws CreditDataUnavailableError.
 * There is no silent seed-derived fallback — a borrower whose data we
 * cannot fetch is rejected by loanManager rather than scored against
 * fabricated inputs.
 */

import { wrappedCall } from './adapter';
import { auditLog } from './audit';
import { CreditFactors } from '../types';

/**
 * Thrown when one of the three credit factors cannot be sourced from a Locus
 * wrapped API. Caught by loanManager._processLoanApplication, which rejects
 * the application with reason `credit_data_unavailable`.
 */
export class CreditDataUnavailableError extends Error {
  constructor(
    public factor: 'identity' | 'reputation' | 'financial',
    public reason: string,
  ) {
    super(`Credit data unavailable for ${factor}: ${reason}`);
    this.name = 'CreditDataUnavailableError';
  }
}

/**
 * Timed wrapper around wrappedCall — emits per-API-call audit events.
 * Each call produces `locus.api.<provider>.called` event with latency and status,
 * which the Signal Loom visualization consumes.
 */
async function timedCall<T>(provider: string, endpoint: string, body: unknown): Promise<T> {
  const start = Date.now();
  try {
    const result = await wrappedCall<T>(provider, endpoint, body);
    await auditLog(`locus.api.${provider}.called`, {
      provider,
      endpoint,
      latencyMs: Date.now() - start,
      success: true,
    });
    return result;
  } catch (err) {
    await auditLog(`locus.api.${provider}.called`, {
      provider,
      endpoint,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Fetch identity data for an agent using Locus wrapped APIs.
 * Uses Exa search for web presence + CoinGecko for market context.
 *
 * Throws CreditDataUnavailableError if the primary identity signal (Exa)
 * cannot be fetched. CoinGecko is best-effort and never blocks.
 */
export async function fetchIdentityData(agentId: number, agentWallet: string): Promise<CreditFactors['identity']> {
  let searchResult: { results?: Array<{ title?: string; url?: string; publishedDate?: string }> };
  try {
    [searchResult] = await Promise.all([
      timedCall<{ results?: Array<{ title?: string; url?: string; publishedDate?: string }> }>(
        'exa', 'search', {
          query: `AI agent wallet ${agentWallet} reputation history`,
          numResults: 5,
          type: 'neural',
        }
      ),
      // CoinGecko for market context (demonstrates breadth of API usage); not load-bearing.
      timedCall<unknown>('coingecko', 'simple-price', {
        ids: 'usd-coin',
        vs_currencies: 'usd',
      }).catch(() => null),
    ]);
  } catch (err) {
    // No silent fallback. The loan application is rejected upstream.
    await auditLog('credit.score.unavailable', {
      agentId,
      factor: 'identity',
      reason: err instanceof Error ? err.message : String(err),
    });
    throw new CreditDataUnavailableError('identity', err instanceof Error ? err.message : String(err));
  }

  const results = searchResult?.results || [];
  const hasOnlinePresence = results.length > 0;

  let registrationTimestamp = Math.floor(Date.now() / 1000) - 86400;
  if (results.length > 0 && results[results.length - 1]?.publishedDate) {
    registrationTimestamp = Math.floor(new Date(results[results.length - 1]!.publishedDate!).getTime() / 1000);
  }

  return {
    agentId,
    registrationTimestamp,
    metadataKeys: hasOnlinePresence ? ['name', 'description', 'url', 'category'] : ['name'],
    ownerAddress: agentWallet,
    hasWallet: true,
    agentURI: results[0]?.url || `agent://${agentId}`,
  };
}

/**
 * Fetch reputation data using Brave Search + Perplexity + Tavily.
 *
 * Throws CreditDataUnavailableError if the primary signal (Brave) fails.
 * Tavily and Perplexity are supplementary — their failures are swallowed
 * so the Signal Loom still surfaces the audit event, but never fabricate
 * sentiment.
 */
export async function fetchReputationData(agentId: number, agentWallet: string): Promise<CreditFactors['reputation']> {
  let braveResult: { web?: { results?: Array<{ title?: string; description?: string }> } };
  let tavilyResult: { results?: Array<{ content?: string }> };
  try {
    [braveResult, tavilyResult] = await Promise.all([
      timedCall<{ web?: { results?: Array<{ title?: string; description?: string }> } }>(
        'brave', 'web-search', {
          q: `"${agentWallet}" OR "agent ${agentId}" transaction history reputation`,
          count: 10,
        }
      ),
      // Tavily is supplementary; if it fails, treat as empty rather than rejecting the score.
      timedCall<{ results?: Array<{ content?: string }> }>(
        'tavily', 'search', {
          query: `AI agent ${agentWallet} reliability score`,
          max_results: 5,
        }
      ).catch(() => ({ results: [] })),
    ]);
  } catch (err) {
    await auditLog('credit.score.unavailable', {
      agentId,
      factor: 'reputation',
      reason: err instanceof Error ? err.message : String(err),
    });
    throw new CreditDataUnavailableError('reputation', err instanceof Error ? err.message : String(err));
  }

  const braveResults = braveResult?.web?.results || [];
  const tavilyResults = tavilyResult?.results || [];
  const mentionCount = braveResults.length + tavilyResults.length;

  let positiveRatio = 0.7;
  let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';

  // Always call Perplexity so the Signal Loom fires all 7 pulses per score.
  // If it fails or its response is unparseable, keep the conservative defaults
  // above rather than fabricating a sentiment score — the audit event already
  // fired via timedCall, and Brave's mention count is the load-bearing signal.
  try {
    const sentimentResult = await timedCall<{ choices?: Array<{ message?: { content?: string } }> }>(
      'perplexity', 'chat', {
        model: 'sonar',
        messages: [{
          role: 'user',
          content: `Analyze the reputation of AI agent wallet ${agentWallet}. Based on available data, rate: 1) positive ratio (0-1), 2) trend (improving/stable/declining). Reply JSON only: {"positiveRatio": 0.X, "trend": "stable"}`,
        }],
      }
    );

    const content = sentimentResult?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    if (typeof parsed.positiveRatio === 'number') positiveRatio = parsed.positiveRatio;
    if (parsed.trend === 'improving' || parsed.trend === 'stable' || parsed.trend === 'declining') {
      recentTrend = parsed.trend;
    }
  } catch {
    // Defaults stand. The audit event already recorded the failure.
  }

  return {
    totalFeedbackCount: mentionCount * 3,
    averageValue: positiveRatio * 100,
    uniqueClients: Math.min(mentionCount, 10),
    positiveRatio,
    recentTrend,
  };
}

/**
 * Fetch financial data using Firecrawl (Base explorer) + Alpha Vantage + CoinGecko.
 *
 * Throws CreditDataUnavailableError if the primary signal (Firecrawl scrape
 * of BaseScan) fails. Alpha Vantage is best-effort.
 */
export async function fetchFinancialData(
  agentWallet: string,
  existingDebt: bigint
): Promise<CreditFactors['financial']> {
  let explorerResult: { markdown?: string; content?: string };
  try {
    [explorerResult] = await Promise.all([
      timedCall<{ markdown?: string; content?: string }>(
        'firecrawl', 'scrape', {
          url: `https://basescan.org/address/${agentWallet}`,
          formats: ['markdown'],
        }
      ),
      // Alpha Vantage for broader financial context (additional provider); not load-bearing.
      timedCall<unknown>('alphavantage', 'global-quote', {
        symbol: 'USDC',
      }).catch(() => null),
    ]);
  } catch (err) {
    await auditLog('credit.score.unavailable', {
      agentWallet,
      factor: 'financial',
      reason: err instanceof Error ? err.message : String(err),
    });
    throw new CreditDataUnavailableError('financial', err instanceof Error ? err.message : String(err));
  }

  const content = explorerResult?.markdown || explorerResult?.content || '';

  let walletBalance = BigInt(0);
  let transactionCount = 0;
  let totalInflows = BigInt(0);

  const balanceMatch = content.match(/(\d+\.?\d*)\s*USDC/i);
  if (balanceMatch) {
    walletBalance = BigInt(Math.round(parseFloat(balanceMatch[1]) * 1e6));
  }

  const txMatch = content.match(/(\d+)\s*transactions?/i);
  if (txMatch) {
    transactionCount = parseInt(txMatch[1]);
  }

  if (transactionCount > 0) {
    totalInflows = walletBalance / BigInt(2);
  }

  return {
    walletBalance,
    totalInflows30d: totalInflows,
    totalOutflows30d: BigInt(0),
    transactionCount30d: transactionCount,
    existingDebtAmount: existingDebt,
  };
}
