/**
 * Sovra integration — pulls live state from sovra.dev's public API.
 *
 * Sovra is an autonomous "agent media company" built by Gajesh Naik
 * (Eigen Labs). Users bid USDC on Base for the agent to post content;
 * the agent signs its posts with a verifiable signature.
 *
 * Endpoints we use:
 *  - GET /api/auction/state  → current auction, top bid, settle times
 *  - GET /api/feed           → recent signed posts
 */

const SOVRA_BASE = 'https://www.sovra.dev/api';

export interface SovraAuctionState {
  lastSettledAt: number;
  nextSettleAt: number;
  settled: boolean;
  bidCount: number;
  topBid?: {
    bidder: string;
    amountUsdc: number;
    requestText: string;
    chain: string;
  };
}

export interface SovraFeedPost {
  id: string;
  tweetId?: string;
  text: string;
  imagePath?: string | null;
  videoPath?: string | null;
  quotedTweetId?: string | null;
  signature: string;
  signerAddress: string;
  createdAt?: string;
}

export interface SovraLiveSnapshot {
  auction: SovraAuctionState;
  recentPosts: SovraFeedPost[];
  fetchedAt: number;
  signerAddress?: string;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Sovra ${url} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSovraAuction(): Promise<SovraAuctionState> {
  return fetchJson<SovraAuctionState>(`${SOVRA_BASE}/auction/state`);
}

export async function fetchSovraFeed(limit = 5): Promise<SovraFeedPost[]> {
  const all = await fetchJson<SovraFeedPost[]>(`${SOVRA_BASE}/feed`);
  return all.slice(0, limit);
}

export async function fetchSovraLiveSnapshot(): Promise<SovraLiveSnapshot> {
  const [auction, posts] = await Promise.all([
    fetchSovraAuction(),
    fetchSovraFeed(5).catch(() => []),
  ]);
  return {
    auction,
    recentPosts: posts,
    fetchedAt: Date.now(),
    signerAddress: posts[0]?.signerAddress,
  };
}
