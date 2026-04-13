export interface CreditFactors {
  identity: {
    agentId: number;
    registrationTimestamp: number;
    metadataKeys: string[];
    ownerAddress: string;
    hasWallet: boolean;
    agentURI: string;
  };
  reputation: {
    totalFeedbackCount: number;
    averageValue: number;
    uniqueClients: number;
    positiveRatio: number;
    recentTrend: 'improving' | 'stable' | 'declining';
  };
  financial: {
    walletBalance: bigint;
    totalInflows30d: bigint;
    totalOutflows30d: bigint;
    transactionCount30d: number;
    existingDebtAmount: bigint;
  };
}

export interface ScoreBreakdown {
  identityScore: number;      // 0-34
  reputationScore: number;    // 0-33
  financialScore: number;     // 0-33
  totalScore: number;         // 0-100
  reasoning: string;
}

export interface CreditScore {
  agentId: number;
  agentWallet: string;
  score: ScoreBreakdown;
  factors: CreditFactors;
  computedAt: number;
  requestId: string;
}

export interface CreditApplication {
  agentId: number;
  agentWallet: string;
  requestedAmount: bigint;
  purpose: LoanPurpose;
  proposedTermDays: number;
}

export type LoanPurpose = 'compute' | 'inference' | 'scaling' | 'cashflow' | 'api_access' | 'other';
