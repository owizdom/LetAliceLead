/**
 * Credit scoring data sources via Locus wrapped APIs.
 * Replaces ERC-8004 on-chain data fetching.
 */

import { wrappedCall } from './adapter';
import { CreditFactors } from '../types';

/**
 * Fetch identity data for an agent using Locus wrapped APIs.
 * Uses Exa search to find agent reputation and history.
 */
export async function fetchIdentityData(agentId: number, agentWallet: string): Promise<CreditFactors['identity']> {
  try {
    const searchResult = await wrappedCall<{ results?: Array<{ title?: string; url?: string; publishedDate?: string }> }>(
      'exa', 'search', {
        query: `AI agent wallet ${agentWallet} reputation history`,
        numResults: 5,
        type: 'neural',
      }
    );

    const results = searchResult?.results || [];
    const hasOnlinePresence = results.length > 0;

    // Estimate agent age from earliest search result
    let registrationTimestamp = Math.floor(Date.now() / 1000) - 86400; // default: 1 day old
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
  } catch {
    // Fallback: return minimal identity
    return {
      agentId,
      registrationTimestamp: Math.floor(Date.now() / 1000) - 86400 * 30,
      metadataKeys: ['name', 'wallet'],
      ownerAddress: agentWallet,
      hasWallet: true,
      agentURI: `agent://${agentId}`,
    };
  }
}

/**
 * Fetch reputation data using Brave Search + Perplexity analysis.
 */
export async function fetchReputationData(agentId: number, agentWallet: string): Promise<CreditFactors['reputation']> {
  try {
    // Use Brave Search for agent reputation signals
    const braveResult = await wrappedCall<{ web?: { results?: Array<{ title?: string; description?: string }> } }>(
      'brave-search', 'web', {
        q: `"${agentWallet}" OR "agent ${agentId}" transaction history reputation`,
        count: 10,
      }
    );

    const results = braveResult?.web?.results || [];
    const mentionCount = results.length;

    // Analyze sentiment if we have results
    let positiveRatio = 0.7; // default neutral-positive
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';

    if (mentionCount > 0) {
      try {
        const sentimentResult = await wrappedCall<{ choices?: Array<{ message?: { content?: string } }> }>(
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
        if (parsed.positiveRatio) positiveRatio = parsed.positiveRatio;
        if (parsed.trend) recentTrend = parsed.trend;
      } catch {
        // Use defaults
      }
    }

    return {
      totalFeedbackCount: mentionCount * 3, // estimate from web presence
      averageValue: positiveRatio * 100,
      uniqueClients: Math.min(mentionCount, 10),
      positiveRatio,
      recentTrend,
    };
  } catch {
    return {
      totalFeedbackCount: 5,
      averageValue: 70,
      uniqueClients: 2,
      positiveRatio: 0.7,
      recentTrend: 'stable',
    };
  }
}

/**
 * Fetch financial data using Firecrawl (Base explorer) + CoinGecko.
 */
export async function fetchFinancialData(
  agentWallet: string,
  existingDebt: bigint
): Promise<CreditFactors['financial']> {
  try {
    // Scrape Base explorer for wallet activity
    const explorerResult = await wrappedCall<{ markdown?: string; content?: string }>(
      'firecrawl', 'scrape', {
        url: `https://basescan.org/address/${agentWallet}`,
        formats: ['markdown'],
      }
    );

    const content = explorerResult?.markdown || explorerResult?.content || '';

    // Parse balance and tx count from explorer page
    let walletBalance = BigInt(0);
    let transactionCount = 0;
    let totalInflows = BigInt(0);

    // Try to extract USDC balance
    const balanceMatch = content.match(/(\d+\.?\d*)\s*USDC/i);
    if (balanceMatch) {
      walletBalance = BigInt(Math.round(parseFloat(balanceMatch[1]) * 1e6));
    }

    // Try to extract transaction count
    const txMatch = content.match(/(\d+)\s*transactions?/i);
    if (txMatch) {
      transactionCount = parseInt(txMatch[1]);
    }

    // Estimate inflows from tx count
    if (transactionCount > 0) {
      totalInflows = walletBalance / BigInt(2); // rough estimate
    }

    return {
      walletBalance,
      totalInflows30d: totalInflows,
      totalOutflows30d: BigInt(0),
      transactionCount30d: transactionCount,
      existingDebtAmount: existingDebt,
    };
  } catch {
    // Fallback: minimal financial data
    return {
      walletBalance: BigInt(10_000_000), // 10 USDC default
      totalInflows30d: BigInt(5_000_000),
      totalOutflows30d: BigInt(2_000_000),
      transactionCount30d: 5,
      existingDebtAmount: existingDebt,
    };
  }
}
