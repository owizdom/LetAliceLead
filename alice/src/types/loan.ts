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
}

export interface LoanDecision {
  approved: boolean;
  loan?: Loan;
  rejectionReason?: string;
  creditScore: number;
  offeredTerms?: LoanTerms;
}
