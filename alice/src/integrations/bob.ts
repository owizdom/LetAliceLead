/**
 * bobIsAlive integration — pulls Bob's live organism state from his public API.
 *
 * Bob is an autonomous digital organism built by @owizdom. He must earn
 * credits to pay for his own compute. If his balance hits zero, he dies.
 *
 * Endpoints we use:
 *  - GET /api/heartbeat  → balance, mood, ttd, activity, tickCount
 *  - GET /api/organism   → full organism state with identity
 *  - GET /api/chain      → on-chain heartbeats, swaps, staking
 *  - GET /api/monologue  → real-time stream of Bob's thoughts
 *  - GET /api/earnings   → ledger of earn/burn events
 */

const BOB_BASE = process.env.BOB_API_URL || 'https://bob-production-2c39.up.railway.app';

export interface BobHeartbeat {
  alive: boolean;
  balance: number;
  burnRate: number;
  earnRate: number;
  netRate: number;
  ttd: number;              // time-to-death in seconds
  uptime: number;
  activity: string;
  currentTaskId: string | null;
  tasksCompleted: number;
  tickCount: number;
  mood: 'comfortable' | 'cautious' | 'anxious' | 'critical' | 'dead' | string;
}

export interface BobOrganism {
  id: string;
  status: 'alive' | 'dead' | string;
  activity: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  tasksCompleted: number;
  tasksFailed: number;
  bornAt: number;
  diedAt: number | null;
  tickCount: number;
  identity: {
    publicKey?: string;
    fingerprint?: string;
    starknetAddress?: string;
  };
}

export interface BobChain {
  enabled: boolean;
  totalHeartbeats: number;
  totalEmergencyInjections: number;
  totalSwaps: number;
  totalSwapVolume: number;
  isStakedEndur: boolean;
  stakeAmount: number;
  ethBalance: string;
  lastHeartbeat: number;
  recentTxs: Array<{ hash?: string; type?: string; timestamp?: number }>;
}

export interface BobMonologueEntry {
  id: number;
  type: string;
  text: string;
  timestamp: number;
}

export interface BobLiveSnapshot {
  heartbeat: BobHeartbeat;
  organism: BobOrganism;
  chain: BobChain;
  recentThoughts: BobMonologueEntry[];
  fetchedAt: number;
  apiUrl: string;
}

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Bob ${url} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBobLiveSnapshot(): Promise<BobLiveSnapshot> {
  const [heartbeat, organism, chain, monologue] = await Promise.all([
    fetchJson<BobHeartbeat>(`${BOB_BASE}/api/heartbeat`),
    fetchJson<BobOrganism>(`${BOB_BASE}/api/organism`),
    fetchJson<BobChain>(`${BOB_BASE}/api/chain`).catch(
      () =>
        ({
          enabled: false,
          totalHeartbeats: 0,
          totalEmergencyInjections: 0,
          totalSwaps: 0,
          totalSwapVolume: 0,
          isStakedEndur: false,
          stakeAmount: 0,
          ethBalance: '0',
          lastHeartbeat: 0,
          recentTxs: [],
        }) as BobChain
    ),
    fetchJson<BobMonologueEntry[]>(`${BOB_BASE}/api/monologue`).catch(() => [] as BobMonologueEntry[]),
  ]);
  return {
    heartbeat,
    organism,
    chain,
    recentThoughts: monologue.slice(-5).reverse(),
    fetchedAt: Date.now(),
    apiUrl: BOB_BASE,
  };
}
