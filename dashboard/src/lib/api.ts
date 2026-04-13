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

export async function runDemo(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/demo/run`, { method: "POST" });
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
