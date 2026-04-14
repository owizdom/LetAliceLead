"use client";

import { useState } from "react";

export interface RegisteredAgent {
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
}

interface RegistryProps {
  agents: RegisteredAgent[];
  apiBase: string;
  onRefresh: () => void;
}

function statusStyle(status: string): { bg: string; fg: string; label: string; dot: string } {
  switch (status) {
    case 'live':
      return { bg: '#EDF4E3', fg: 'var(--success)', label: 'Live', dot: 'var(--success)' };
    case 'dormant':
      return { bg: 'var(--surface-2)', fg: 'var(--muted)', label: 'Dormant', dot: 'var(--muted)' };
    default:
      return { bg: 'var(--accent-soft)', fg: 'var(--accent)', label: 'Registered', dot: 'var(--accent)' };
  }
}

function chainLabel(chain: string): string {
  return chain.charAt(0).toUpperCase() + chain.slice(1);
}

export default function Registry({ agents, apiBase, onRefresh }: RegistryProps) {
  const [scoringId, setScoringId] = useState<number | null>(null);

  async function scoreAgent(agentId: number) {
    setScoringId(agentId);
    try {
      await fetch(`${apiBase}/api/registry/${agentId}/score`, { method: 'POST' });
      onRefresh();
    } catch {
      // ignore, UI will show next poll
    } finally {
      setScoringId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {agents.map((agent) => {
        const st = statusStyle(agent.status);
        const isScoring = scoringId === agent.agentId;

        return (
          <div
            key={agent.agentId}
            className="rounded-xl border bg-white p-5 flex flex-col"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3
                  className="font-serif-display text-lg tracking-tight"
                  style={{ color: 'var(--text)' }}
                >
                  {agent.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {agent.tagline}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: st.dot }}
                />
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ background: st.bg, color: st.fg }}
                >
                  {st.label}
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
              {agent.description}
            </p>

            <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
                  Credit score
                </p>
                {agent.creditScore !== undefined ? (
                  <p className="font-mono-tokens text-2xl tabular-nums" style={{ color: 'var(--text)' }}>
                    {agent.creditScore}<span className="text-sm" style={{ color: 'var(--muted)' }}>/100</span>
                  </p>
                ) : (
                  <p className="font-mono-tokens text-sm" style={{ color: 'var(--muted)' }}>
                    — not scored
                  </p>
                )}
                {agent.scoreBreakdown && (
                  <p className="text-[10px] mt-1 font-mono-tokens" style={{ color: 'var(--muted)' }}>
                    I:{agent.scoreBreakdown.identityScore} R:{agent.scoreBreakdown.reputationScore} F:{agent.scoreBreakdown.financialScore}
                  </p>
                )}
              </div>
              <button
                onClick={() => scoreAgent(agent.agentId)}
                disabled={isScoring}
                className="text-xs font-medium px-3 py-1.5 rounded-md transition-all disabled:opacity-50"
                style={{
                  background: isScoring ? 'var(--surface-2)' : 'var(--text)',
                  color: isScoring ? 'var(--muted)' : 'var(--bg)',
                }}
              >
                {isScoring ? 'Scoring…' : agent.creditScore ? 'Re-score' : 'Score now'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono-tokens" style={{ color: 'var(--muted)' }}>
                  {chainLabel(agent.chain)}
                </span>
                {agent.wallet && agent.wallet !== '0x0000000000000000000000000000000000000000' && (
                  <a
                    href={`https://basescan.org/address/${agent.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-tokens hover:underline"
                    style={{ color: 'var(--muted)' }}
                  >
                    {agent.wallet.slice(0, 6)}…{agent.wallet.slice(-4)}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3">
                {agent.github && (
                  <a
                    href={agent.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'var(--muted)' }}
                  >
                    GitHub
                  </a>
                )}
                {agent.website && (
                  <a
                    href={agent.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'var(--muted)' }}
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
