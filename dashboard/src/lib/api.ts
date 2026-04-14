const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface Portfolio {
  totalReserves: string;
  deployedCapital: string;
  availableCapital: string;
  totalInterestEarned: string;
  activeLoans: Loan[];
  completedLoans: Loan[];
  defaultedLoans: Loan[];
  lastUpdated: number;
}

export interface RiskMetrics {
  reserveRatio: number;
  defaultRate: number;
  averageCreditScore: number;
  concentrationRisk: number;
  totalExposure: string;
  weightedAverageAPR: number;
  lendingHalted: boolean;
  haltReason?: string;
  computedAt: number;
}

export interface Loan {
  id: string;
  borrowerAgentId: number;
  borrowerWallet: string;
  terms: {
    principalAmount: string;
    interestRateAPR: number;
    termDays: number;
    totalRepayment: string;
    creditScoreAtOrigination: number;
  };
  purpose: string;
  status: string;
  locusTxId?: string;
  originatedAt: number;
  maturityAt: number;
  amountRepaid: string;
  repaymentHistory: { amount: string; timestamp: number; txHash: string }[];
  riskScore: number;
  lastRiskCheck: number;
}

export interface Dashboard {
  portfolio: Portfolio;
  metrics: RiskMetrics;
  bankWallet: string;
  uptime: number;
}

export interface AuditEntry {
  timestamp: number;
  action: string;
  data: Record<string, unknown>;
}

export async function fetchDashboard(): Promise<Dashboard> {
  const res = await fetch(`${API_BASE}/api/portfolio`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchAuditLog(limit = 50): Promise<{ count: number; riskCycles: number; entries: AuditEntry[] }> {
  const res = await fetch(`${API_BASE}/api/portfolio/audit?limit=${limit}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchLoans(): Promise<{ count: number; loans: Loan[] }> {
  const res = await fetch(`${API_BASE}/api/loans`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchRegistry(): Promise<{ count: number; agents: RegisteredAgentData[] }> {
  const res = await fetch(`${API_BASE}/api/registry`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface RegisteredAgentData {
  agentId: number;
  name: string;
  tagline: string;
  description: string;
  wallet: string;
  chain: string;
  status: 'live' | 'dormant' | 'registered';
  github?: string;
  website?: string;
  registeredAt: number;
  creditScore?: number;
  scoredAt?: number;
  scoreBreakdown?: {
    identityScore: number;
    reputationScore: number;
    financialScore: number;
    reasoning?: string;
  };
  liveState?: {
    source: 'sovra' | 'bob' | 'other';
    fetchedAt: number;
    data: unknown;
  };
}

export interface BobLiveData {
  heartbeat: {
    alive: boolean;
    balance: number;
    burnRate: number;
    earnRate: number;
    netRate: number;
    ttd: number;
    uptime: number;
    activity: string;
    currentTaskId: string | null;
    tasksCompleted: number;
    tickCount: number;
    mood: string;
  };
  organism: {
    id: string;
    status: string;
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
  };
  chain: {
    enabled: boolean;
    totalHeartbeats: number;
    totalSwaps: number;
    totalSwapVolume: number;
    isStakedEndur: boolean;
    stakeAmount: number;
    ethBalance: string;
    lastHeartbeat: number;
    recentTxs: Array<{ hash?: string; type?: string; timestamp?: number }>;
  };
  recentThoughts: Array<{ id: number; type: string; text: string; timestamp: number }>;
  fetchedAt: number;
  apiUrl: string;
}

export interface SovraLiveData {
  auction: {
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
  };
  recentPosts: Array<{
    id: string;
    tweetId?: string;
    text: string;
    imagePath?: string | null;
    signature: string;
    signerAddress: string;
    createdAt?: string;
  }>;
  fetchedAt: number;
  signerAddress?: string;
}

export async function requestLoan(params: {
  agentId: number;
  agentWallet: string;
  amount: number;
  purpose: string;
  termDays: number;
}): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/loans/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

/** Convert wei string to USDC float */
export function weiToUSDC(wei: string): number {
  return Number(wei) / 1e6;
}

/** Format USDC for display */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
