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
    wallet: '0x0000000000000000000000000000000000000000',
    chain: 'base',
    status: 'registered',
    github: 'https://github.com/Gajesh2007/sovra',
    website: 'https://sovra.dev',
    registeredAt: Date.now(),
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
  const agent: RegisteredAgent = {
    agentId: nextAgentId++,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    wallet: input.wallet,
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
