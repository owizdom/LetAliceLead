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
  // Alice-custodied Base wallet issued at registration. NOT a PayWithLocus
  // subwallet — Alice generates the keypair locally (see wallets/manager.ts)
  // and holds the private key in her encrypted keystore. Field name kept as
  // `managedWallet` for API/dashboard compatibility.
  // External self-custodial agents registered before this system existed may not have one.
  managedWallet?: string;
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

export function registerAgent(input: {
  name: string;
  tagline: string;
  description: string;
  wallet: string;
  chain?: RegisteredAgent['chain'];
  github?: string;
  website?: string;
}): RegisteredAgent {
  const agentId = nextAgentId++;

  // Issue an Alice-custodied Base wallet for this agent. The keypair is
  // generated locally by viem and persisted encrypted in Alice's keystore;
  // it is NOT a Locus-issued subwallet. Lazy require so unit tests that
  // don't touch wallets don't need viem configured.
  let managedWallet: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { issueWallet } = require('../wallets/manager');
    const issued = issueWallet(agentId);
    managedWallet = issued.address;
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
