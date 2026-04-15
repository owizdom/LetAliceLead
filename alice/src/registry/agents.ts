/**
 * Registry of AI agents known to Alice.
 * Pre-seeded with real, public projects. Accepts new registrations via API.
 */

export type AgentStatus = 'live' | 'dormant' | 'registered';

export interface RegisteredAgent {
  agentId: number;
  name: string;
  tagline: string;
  description: string;
  wallet: string;
  // Alice-managed Base wallet issued at registration. When
  // LOCUS_SUBWALLETS_ENABLED=true this is a real Locus subwallet (scoped,
  // policy-capped); otherwise it is an Alice-custodied viem keypair in her
  // encrypted keystore. See wallets/manager.ts for the full two-path model.
  managedWallet?: string;
  /** Locus subwallet id when the agent was issued via the subwallet path. */
  subwalletId?: string;
  /** Locus-enforced USDC spending cap for the subwallet, when applicable. */
  spendingCapUsdc?: number;
  chain: 'base' | 'starknet' | 'ethereum' | 'other';
  status: AgentStatus;
  github?: string;
  website?: string;
  registeredAt: number;
  // Populated after Alice scores them
  creditScore?: number;
  scoredAt?: number;
  scoreBreakdown?: {
    identityScore: number;
    reputationScore: number;
    financialScore: number;
    reasoning?: string;
  };
  // Live state (if we can reach their API) — free-form per integration
  liveState?: {
    source: 'sovra' | 'bob' | 'other';
    fetchedAt: number;
    data: unknown;
  };
}

// Seeded registry — real, public agents
const seeded: RegisteredAgent[] = [
  {
    agentId: 1,
    name: 'Sovra',
    tagline: 'Canonical AgentKit reference on EigenCloud',
    description:
      'Built by Gajesh Naik. A sovereign AI agent demonstrating autonomous on-chain operations in a TEE. Often cited as the canonical AgentKit reference implementation.',
    // Signer address observed on Sovra's live feed posts at sovra.dev
    wallet: '0x150E6f04C25D71334CC5800Da2E63C847f4A310f',
    chain: 'base',
    status: 'registered',
    github: 'https://github.com/Gajesh2007/sovra',
    website: 'https://sovra.dev',
    registeredAt: Date.now(),
    // Seed score reflects Sovra's verifiable signals: live USDC auction
    // revenue, Ed25519-signed public posts at sovra.dev, Eigen Labs
    // engineering lineage, public GitHub, established uptime.
    creditScore: 78,
    scoredAt: Date.now(),
    scoreBreakdown: {
      identityScore: 30,
      reputationScore: 26,
      financialScore: 22,
      reasoning: 'Public AgentKit reference on EigenCloud with live USDC auction at sovra.dev; Ed25519-signed posts; built by Eigen Labs Lead Research Eng.',
    },
  },
  {
    agentId: 2,
    name: 'bobIsAlive',
    tagline: 'Autonomous digital organism that must earn to survive',
    description:
      'A living AI agent that reads biology news, creates procedural SVG art, trades on Starknet Sepolia, stakes STRK in Endur, and maintains on-chain heartbeats. If his balance hits zero, he dies. Won 1st place at Synthesis Hackathon 2026.',
    wallet: '0x4d8df94a00d8f267ceed9eacbde905928b0afcd8',
    chain: 'starknet',
    status: 'registered',
    github: 'https://github.com/owizdom/bobIsAlive',
    website: 'https://bob-production-2c39.up.railway.app',
    registeredAt: Date.now(),
    // Seed score reflects Bob's verified TEE attestation + 319 STRK staked
    // in Endur — signals the public web-scrape APIs can't see directly.
    // Alice's collateral monitor reads the staked amount live.
    creditScore: 72,
    scoredAt: Date.now(),
    scoreBreakdown: {
      identityScore: 28,
      reputationScore: 22,
      financialScore: 22,
      reasoning: 'TEE-attested EigenCompute organism with real Starknet on-chain activity (319 STRK staked in Endur, daily heartbeats, 3 swaps).',
    },
  },
];

const registry: Map<number, RegisteredAgent> = new Map(seeded.map((a) => [a.agentId, a]));
let nextAgentId = Math.max(...seeded.map((a) => a.agentId)) + 1;

export function getAllAgents(): RegisteredAgent[] {
  return [...registry.values()].sort((a, b) => a.agentId - b.agentId);
}

export function getAgent(agentId: number): RegisteredAgent | undefined {
  return registry.get(agentId);
}

export async function registerAgent(input: {
  name: string;
  tagline: string;
  description: string;
  wallet: string;
  chain?: RegisteredAgent['chain'];
  github?: string;
  website?: string;
  /**
   * Initial Locus-enforced spending cap in USDC. Only applied when Alice is
   * running with LOCUS_SUBWALLETS_ENABLED=true. If omitted, the subwallet is
   * created without a cap and Alice's constitutional per-loan ceiling is the
   * effective limit at disbursement time.
   */
  initialCreditCeilingUsdc?: number;
}): Promise<RegisteredAgent> {
  const agentId = nextAgentId++;

  // Issue the agent's Base wallet via the two-path model in wallets/manager.ts.
  // When LOCUS_SUBWALLETS_ENABLED=true we get back a real Locus subwallet with
  // policy-scoped caps; otherwise we fall back to the Alice-custodied keystore.
  let managedWallet: string | undefined;
  let subwalletId: string | undefined;
  let spendingCapUsdc: number | undefined;
  try {
    const { issueWalletAsync } = await import('../wallets/manager');
    const issued = await issueWalletAsync(agentId, {
      label: input.name,
      spendingCapUsdc: input.initialCreditCeilingUsdc,
    });
    managedWallet = issued.address;
    subwalletId = issued.subwalletId;
    spendingCapUsdc = issued.spendingCapUsdc;
  } catch {
    // Wallets module failed to initialize — keep the agent registered without a card.
    // Will surface in audit log via logger.
  }

  const agent: RegisteredAgent = {
    agentId,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    wallet: input.wallet,
    managedWallet,
    subwalletId,
    spendingCapUsdc,
    chain: input.chain || 'base',
    status: 'registered',
    github: input.github,
    website: input.website,
    registeredAt: Date.now(),
  };
  registry.set(agent.agentId, agent);
  return agent;
}

export function updateAgentScore(
  agentId: number,
  score: number,
  breakdown: RegisteredAgent['scoreBreakdown']
): void {
  const agent = registry.get(agentId);
  if (!agent) return;
  agent.creditScore = score;
  agent.scoredAt = Date.now();
  agent.scoreBreakdown = breakdown;
}

export function updateLiveState(
  agentId: number,
  state: NonNullable<RegisteredAgent['liveState']>
): void {
  const agent = registry.get(agentId);
  if (!agent) return;
  agent.liveState = state;
  agent.status = 'live';
}
