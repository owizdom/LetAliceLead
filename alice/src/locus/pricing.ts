/**
 * Locus wrapped API per-call costs in USDC.
 *
 * Sourced from the Locus wrapped-API catalog (https://beta.paywithlocus.com/wapi/<provider>.md).
 * Used to compute Alice's procurement spend — the USDC she pays Locus providers per
 * credit decision (every score fires 7 calls, one per provider).
 *
 * These are documented unit prices, not real-time billing. Real billing happens on
 * Locus's side; we surface our best estimate so judges can see the agent-to-agent
 * commerce loop quantified.
 */

export const WRAPPED_API_COSTS_USDC: Record<string, number> = {
  exa: 0.01,
  firecrawl: 0.01,
  brave: 0.035,
  perplexity: 0.02,
  coingecko: 0.001,
  tavily: 0.01,
  alphavantage: 0.001,
};

export function getApiCost(provider: string): number {
  return WRAPPED_API_COSTS_USDC[provider] ?? 0;
}

export function getCatalog(): Array<{ provider: string; usdcPerCall: number }> {
  return Object.entries(WRAPPED_API_COSTS_USDC).map(([provider, usdcPerCall]) => ({
    provider,
    usdcPerCall,
  }));
}
