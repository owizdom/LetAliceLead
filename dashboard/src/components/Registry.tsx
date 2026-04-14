"use client";

import { useState } from "react";
import { RegisteredAgentData, SovraLiveData, BobLiveData } from "@/lib/api";

interface RegistryProps {
  agents: RegisteredAgentData[];
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

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function Registry({ agents, apiBase, onRefresh }: RegistryProps) {
  const [scoringId, setScoringId] = useState<number | null>(null);

  async function scoreAgent(agentId: number) {
    setScoringId(agentId);
    try {
      await fetch(`${apiBase}/api/registry/${agentId}/score`, { method: 'POST' });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setScoringId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {agents.map((agent) => {
        const st = statusStyle(agent.status);
        const isScoring = scoringId === agent.agentId;
        const isSovra = agent.liveState?.source === 'sovra';
        const sovraData = isSovra ? (agent.liveState!.data as SovraLiveData) : null;
        const isBob = agent.liveState?.source === 'bob';
        const bobData = isBob ? (agent.liveState!.data as BobLiveData) : null;

        return (
          <div
            key={agent.agentId}
            className="rounded-xl border bg-white p-5 flex flex-col"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-serif-display text-lg tracking-tight" style={{ color: 'var(--text)' }}>
                  {agent.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {agent.tagline}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${agent.status === 'live' ? 'pulse-dot' : ''}`}
                  style={{ background: st.dot }}
                />
                <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: st.bg, color: st.fg }}>
                  {st.label}
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
              {agent.description}
            </p>

            {/* Live Sovra data */}
            {sovraData && (
              <div
                className="mb-4 p-4 rounded-lg"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Live from sovra.dev
                  </p>
                  <p className="text-[10px] font-mono-tokens" style={{ color: 'var(--muted)' }}>
                    {timeAgo(sovraData.fetchedAt)}
                  </p>
                </div>

                {/* Auction */}
                {sovraData.auction.topBid ? (
                  <div className="mb-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Top bid</span>
                      <span
                        className="font-mono-tokens text-sm font-semibold tabular-nums"
                        style={{ color: 'var(--accent)' }}
                      >
                        ${sovraData.auction.topBid.amountUsdc} USDC
                      </span>
                    </div>
                    <p className="text-sm italic leading-snug mb-2 font-serif-display" style={{ color: 'var(--text)' }}>
                      &ldquo;{sovraData.auction.topBid.requestText.length > 120
                        ? sovraData.auction.topBid.requestText.slice(0, 120) + '…'
                        : sovraData.auction.topBid.requestText}&rdquo;
                    </p>
                    <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
                      <a
                        href={`https://basescan.org/address/${sovraData.auction.topBid.bidder}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-tokens hover:underline"
                      >
                        {sovraData.auction.topBid.bidder.slice(0, 8)}…{sovraData.auction.topBid.bidder.slice(-6)}
                      </a>
                      <span>
                        {sovraData.auction.bidCount} bid{sovraData.auction.bidCount !== 1 ? 's' : ''} · settles {timeAgo(sovraData.auction.nextSettleAt * 1000).replace(' ago', ' from now')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic mb-3" style={{ color: 'var(--muted)' }}>
                    No open bids right now.
                  </p>
                )}

                {/* Recent posts */}
                {sovraData.recentPosts.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
                      Recent signed posts
                    </p>
                    <ul className="space-y-1.5">
                      {sovraData.recentPosts.slice(0, 3).map((post) => (
                        <li key={post.id} className="text-xs leading-snug" style={{ color: 'var(--text)' }}>
                          <span className="font-serif-display">
                            {post.text.length > 80 ? post.text.slice(0, 80) + '…' : post.text}
                          </span>
                          {post.tweetId && (
                            <>
                              {' '}
                              <a
                                href={`https://x.com/i/web/status/${post.tweetId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-mono-tokens hover:underline"
                                style={{ color: 'var(--muted)' }}
                              >
                                ↗
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Live Bob data */}
            {bobData && (
              <div
                className="mb-4 p-4 rounded-lg"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Live from bobisalive.com
                  </p>
                  <p className="text-[10px] font-mono-tokens" style={{ color: 'var(--muted)' }}>
                    {timeAgo(bobData.fetchedAt)}
                  </p>
                </div>

                {/* Vital signs */}
                <div className="grid grid-cols-3 gap-3 mb-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
                      Balance
                    </p>
                    <p
                      className="font-mono-tokens text-sm font-semibold tabular-nums"
                      style={{
                        color:
                          bobData.heartbeat.balance < 20
                            ? 'var(--danger)'
                            : bobData.heartbeat.balance < 50
                              ? 'var(--accent)'
                              : 'var(--success)',
                      }}
                    >
                      {bobData.heartbeat.balance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
                      Mood
                    </p>
                    <p
                      className="font-serif-display text-sm italic"
                      style={{
                        color:
                          bobData.heartbeat.mood === 'dead'
                            ? 'var(--danger)'
                            : bobData.heartbeat.mood === 'critical' || bobData.heartbeat.mood === 'anxious'
                              ? 'var(--danger)'
                              : bobData.heartbeat.mood === 'cautious'
                                ? 'var(--accent)'
                                : 'var(--success)',
                      }}
                    >
                      {bobData.heartbeat.mood}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
                      Tick
                    </p>
                    <p className="font-mono-tokens text-sm tabular-nums" style={{ color: 'var(--text)' }}>
                      #{bobData.heartbeat.tickCount}
                    </p>
                  </div>
                </div>

                {/* Activity line */}
                <div className="flex items-baseline justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Activity
                  </span>
                  <span className="text-xs font-serif-display italic" style={{ color: 'var(--text)' }}>
                    {bobData.heartbeat.activity}
                    {bobData.heartbeat.tasksCompleted > 0 && (
                      <span className="ml-2 font-mono-tokens" style={{ color: 'var(--muted)' }}>
                        · {bobData.heartbeat.tasksCompleted} tasks done
                      </span>
                    )}
                  </span>
                </div>

                {/* Monologue */}
                {bobData.recentThoughts.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
                      Last thoughts
                    </p>
                    <ul className="space-y-1.5">
                      {bobData.recentThoughts.slice(0, 3).map((thought) => (
                        <li
                          key={thought.id}
                          className="text-xs leading-snug font-serif-display italic"
                          style={{ color: 'var(--text)' }}
                        >
                          &ldquo;{thought.text.length > 90 ? thought.text.slice(0, 90) + '…' : thought.text}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Credit card — the managed Base wallet Alice issued at registration */}
            {agent.managedWallet && (
              <div
                className="mb-4 p-4 rounded-lg border"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Credit card · managed Base wallet
                  </p>
                  <a
                    href={`https://basescan.org/address/${agent.managedWallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] hover:underline"
                    style={{ color: 'var(--muted)' }}
                  >
                    BaseScan ↗
                  </a>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code
                    className="font-mono-tokens text-xs flex-1 truncate"
                    style={{ color: 'var(--text)' }}
                  >
                    {agent.managedWallet}
                  </code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(agent.managedWallet!)}
                    className="text-[10px] font-medium px-2 py-1 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
                  Alice-issued. Fund this address to cover interest; Alice auto-sweeps at maturity.
                </p>
              </div>
            )}

            {/* Score row */}
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

            {/* Footer: chain, wallet, links */}
            <div className="flex items-center justify-between text-xs flex-wrap gap-2 mt-auto">
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
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
