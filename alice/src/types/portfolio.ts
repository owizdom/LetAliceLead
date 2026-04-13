import { Loan } from './loan';

export interface Portfolio {
  totalReserves: bigint;
  deployedCapital: bigint;
  availableCapital: bigint;
  totalInterestEarned: bigint;
  activeLoans: Loan[];
  completedLoans: Loan[];
  defaultedLoans: Loan[];
  lastUpdated: number;
}

export interface RiskMetrics {
  reserveRatio: number;           // % of total assets kept liquid
  defaultRate: number;            // % of loans that defaulted
  averageCreditScore: number;     // avg score across active borrowers
  concentrationRisk: number;      // max % of portfolio to single deployer
  totalExposure: bigint;
  weightedAverageAPR: number;
  lendingHalted: boolean;
  haltReason?: string;
  computedAt: number;
}

export interface PortfolioDashboard {
  portfolio: Portfolio;
  metrics: RiskMetrics;
  bankWallet: string;
  bankAgentId?: number;
  uptime: number;
}
