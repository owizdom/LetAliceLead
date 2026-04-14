import { LoanPurpose } from './credit';

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  REPAYING = 'REPAYING',
  COMPLETED = 'COMPLETED',
  DEFAULTED = 'DEFAULTED',
  REJECTED = 'REJECTED',
}

export interface LoanTerms {
  principalAmount: bigint;
  interestRateAPR: number;
  termDays: number;
  totalRepayment: bigint;
  creditScoreAtOrigination: number;
}

export interface Loan {
  id: string;
  borrowerAgentId: number;
  borrowerWallet: string;
  // Actual address USDC was disbursed to — may be the agent's external wallet
  // (legacy self-custodial) or their Alice-issued managed wallet. Used by the
  // auto-sweep path to know which wallet to pull repayments from.
  disbursedTo?: string;
  disbursementMode?: 'managed' | 'external';
  terms: LoanTerms;
  purpose: LoanPurpose;
  status: LoanStatus;
  locusTxId?: string;
  originatedAt: number;
  maturityAt: number;
  amountRepaid: bigint;
  repaymentHistory: RepaymentEvent[];
  riskScore: number;
  lastRiskCheck: number;
  /**
   * Cross-chain collateral pledged by the borrower. Read-only — Alice monitors
   * the wallet's balance and re-prices via Locus CoinGecko, but cannot force
   * liquidation off-Base. Drives LTV display + the margin_call tool.
   */
  collateral?: CollateralPledge;
}

export type CollateralChain = 'starknet' | 'ethereum' | 'base' | 'other';
export type CollateralAsset = 'STRK' | 'ETH' | 'USDC' | string;
export type CollateralHealth = 'healthy' | 'warn' | 'margin_call';

export interface CollateralPledge {
  chain: CollateralChain;
  asset: CollateralAsset;
  /** On-chain wallet whose balance Alice monitors */
  wallet: string;
  /** Most recently observed asset balance (units of `asset`) */
  amount: number;
  /** USD value at last refresh (amount * usdPrice) */
  pricedUsdc: number;
  /** principal / pricedUsdc * 100 — undefined if pricedUsdc is 0 */
  ltvPct: number;
  health: CollateralHealth;
  lastPricedAt: number;
}

export interface RepaymentEvent {
  amount: bigint;
  timestamp: number;
  txHash: string;
}

export interface LoanApplication {
  agentId: number;
  agentWallet: string;
  requestedAmount: bigint;
  purpose: LoanPurpose;
  proposedTermDays: number;
  /** Optional collateral pledge — see CollateralPledge. Pre-pricing fields
   * (pricedUsdc, ltvPct, health, lastPricedAt) are filled in by the
   * collateralMonitor at origination. */
  collateral?: Pick<CollateralPledge, 'chain' | 'asset' | 'wallet' | 'amount'>;
}

export interface LoanDecision {
  approved: boolean;
  loan?: Loan;
  rejectionReason?: string;
  creditScore: number;
  offeredTerms?: LoanTerms;
}
