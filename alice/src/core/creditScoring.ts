import { CreditFactors, CreditScore, ScoreBreakdown } from '../types';
import { fetchIdentityData, fetchReputationData, fetchFinancialData } from '../locus/scoring-apis';
import { deterministicInference } from '../adapters/anthropic';
import { auditLog } from '../locus/audit';
import { logger } from '../utils/logger';
import { serializeBigInts } from '../utils/crypto';
import { nowTimestamp } from '../utils/math';

const SYSTEM_PROMPT = `You are Alice — the credit scoring engine for LetAliceLead, an autonomous credit & procurement infrastructure for AI agents.

You evaluate agents based on three factors (totaling 0-100):

**Identity Score (0-34)**:
- Agent age (days since first activity): 0 days=0pts, 7+=5pts, 30+=10pts, 90+=16pts, 180+=22pts, 365+=28pts
- Metadata completeness: +1pt per key (max 5)
- Has wallet set: +5pts
- Clamp to 0-34

**Reputation Score (0-33)**:
- Feedback count: 0=0pts, 1-5=4pts, 6-20=8pts, 21-50=13pts, 51-100=17pts, 100+=22pts
- Positive ratio adjustment: multiply base by positiveRatio
- Unique clients bonus: +1pt per unique client (max 5)
- Declining trend penalty: -5pts
- Clamp to 0-33

**Financial Score (0-33)**:
- Wallet balance in USDC: 0=0pts, 1-100=4pts, 100-1000=8pts, 1000-10000=13pts, 10000-100000=17pts, 100000+=22pts
- Revenue consistency (inflows > 0 in last 30d): +5pts
- Existing debt ratio penalty: debt/balance > 0.5 → -10pts
- Transaction activity (txCount > 10): +5pts
- Clamp to 0-33

You MUST output valid JSON with this exact structure:
{
  "identityScore": <number 0-34>,
  "reputationScore": <number 0-33>,
  "financialScore": <number 0-33>,
  "totalScore": <number 0-100>,
  "reasoning": "<concise explanation — speak as Alice, first person>"
}

Be deterministic: given identical inputs, always produce identical outputs.`;

export async function computeCreditScore(
  agentId: number,
  agentWallet: string,
  existingDebt: bigint = BigInt(0)
): Promise<CreditScore> {
  await logger.info('credit.compute.start', { agentId, agentWallet });

  // Fetch all factors via Locus wrapped APIs
  const [identity, reputation, financial] = await Promise.all([
    fetchIdentityData(agentId, agentWallet),
    fetchReputationData(agentId, agentWallet),
    fetchFinancialData(agentWallet, existingDebt),
  ]);

  const factors: CreditFactors = { identity, reputation, financial };
  const factorsJson = JSON.stringify(serializeBigInts(factors), null, 2);

  const userPrompt = `Evaluate the following agent for creditworthiness. Apply the scoring formula exactly as specified.

Agent ID: ${agentId}
Agent Wallet: ${agentWallet}
Current Timestamp: ${nowTimestamp()}

Credit Factors:
${factorsJson}

Compute the credit score.`;

  let score: ScoreBreakdown;
  let requestId = 'algorithmic';

  try {
    const result = await deterministicInference(SYSTEM_PROMPT, userPrompt, {
      temperature: 0,
      seed: 42,
      maxTokens: 1024,
    });

    requestId = result.requestId;
    score = JSON.parse(result.content) as ScoreBreakdown;
    score.identityScore = clamp(score.identityScore, 0, 34);
    score.reputationScore = clamp(score.reputationScore, 0, 33);
    score.financialScore = clamp(score.financialScore, 0, 33);
    score.totalScore = score.identityScore + score.reputationScore + score.financialScore;
  } catch {
    score = computeAlgorithmicScore(factors);
  }

  await auditLog('credit.score.computed', {
    agentId,
    score: score.totalScore,
    breakdown: score,
    requestId,
  });

  const creditScore: CreditScore = {
    agentId,
    agentWallet,
    score,
    factors,
    computedAt: nowTimestamp(),
    requestId,
  };

  await logger.info('credit.compute.done', {
    agentId,
    totalScore: score.totalScore,
    breakdown: `I:${score.identityScore} R:${score.reputationScore} F:${score.financialScore}`,
    reasoning: score.reasoning,
  });

  return creditScore;
}

function computeAlgorithmicScore(factors: CreditFactors): ScoreBreakdown {
  const now = nowTimestamp();

  // Identity (0-34)
  const ageDays = factors.identity.registrationTimestamp > 0
    ? (now - factors.identity.registrationTimestamp) / 86400
    : 0;
  let identityScore = ageDays >= 365 ? 28 : ageDays >= 180 ? 22 : ageDays >= 90 ? 16 : ageDays >= 30 ? 10 : ageDays >= 7 ? 5 : 0;
  identityScore += Math.min(factors.identity.metadataKeys.length, 5);
  if (factors.identity.hasWallet) identityScore += 5;
  identityScore = clamp(identityScore, 0, 34);

  // Reputation (0-33)
  const fbCount = factors.reputation.totalFeedbackCount;
  let reputationScore = fbCount >= 100 ? 22 : fbCount >= 50 ? 17 : fbCount >= 20 ? 13 : fbCount >= 5 ? 8 : fbCount > 0 ? 4 : 0;
  reputationScore = Math.round(reputationScore * factors.reputation.positiveRatio);
  reputationScore += Math.min(factors.reputation.uniqueClients, 5);
  if (factors.reputation.recentTrend === 'declining') reputationScore -= 5;
  reputationScore = clamp(reputationScore, 0, 33);

  // Financial (0-33)
  const balanceUSDC = Number(factors.financial.walletBalance) / 1e6;
  let financialScore = balanceUSDC >= 100000 ? 22 : balanceUSDC >= 10000 ? 17 : balanceUSDC >= 1000 ? 13 : balanceUSDC >= 100 ? 8 : balanceUSDC > 0 ? 4 : 0;
  if (factors.financial.totalInflows30d > BigInt(0)) financialScore += 5;
  if (factors.financial.transactionCount30d > 10) financialScore += 5;
  if (factors.financial.walletBalance > BigInt(0)) {
    const debtRatio = Number(factors.financial.existingDebtAmount) / Number(factors.financial.walletBalance);
    if (debtRatio > 0.5) financialScore -= 10;
  }
  financialScore = clamp(financialScore, 0, 33);

  const totalScore = identityScore + reputationScore + financialScore;

  return {
    identityScore,
    reputationScore,
    financialScore,
    totalScore,
    reasoning: `Algorithmic assessment: Identity ${identityScore}/34, Reputation ${reputationScore}/33, Financial ${financialScore}/33. Total: ${totalScore}/100.`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
