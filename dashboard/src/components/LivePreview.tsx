"use client";

import Link from "next/link";
import { RegisteredAgentData, SovraLiveData, BobLiveData } from "@/lib/api";

interface LivePreviewProps {
  agents: RegisteredAgentData[];
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function SovraTile({ data, agent }: { data: SovraLiveData; agent: RegisteredAgentData }) {
  const tb = data.auction.topBid;
  return (
    <Link
      href="/agents"
      className="block rounded-xl border bg-white p-5 transition-all hover:border-[var(--border-light)]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Live · sovra.dev
          </p>
          <h3 className="font-serif-display text-lg" style={{ color: "var(--text)" }}>
            {agent.name}
          </h3>
        </div>
        <div className="w-1.5 h-1.5 rounded-full pulse-dot mt-2" style={{ background: "var(--success)" }} />
      </div>
      {tb ? (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs" style={{ color: "var(--muted)" }}>Top bid</span>
            <span
              className="font-mono-tokens text-lg font-semibold tabular-nums"
              style={{ color: "var(--accent)" }}
            >
              ${tb.amountUsdc} USDC
            </span>
          </div>
          <p
            className="text-sm italic leading-snug font-serif-display line-clamp-2"
            style={{ color: "var(--text)" }}
          >
            &ldquo;{tb.requestText.length > 90 ? tb.requestText.slice(0, 90) + "…" : tb.requestText}&rdquo;
          </p>
        </>
      ) : (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          No open bids.
        </p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <span>{data.auction.bidCount} bid{data.auction.bidCount !== 1 ? "s" : ""} · {data.recentPosts.length} recent posts</span>
        <span className="font-mono-tokens">{timeAgo(data.fetchedAt)}</span>
      </div>
    </Link>
  );
}

function BobTile({ data, agent }: { data: BobLiveData; agent: RegisteredAgentData }) {
  const moodColor =
    data.heartbeat.mood === "dead"
      ? "var(--danger)"
      : data.heartbeat.mood === "critical" || data.heartbeat.mood === "anxious"
        ? "var(--danger)"
        : data.heartbeat.mood === "cautious"
          ? "var(--accent)"
          : "var(--success)";
  const balanceColor =
    data.heartbeat.balance < 20 ? "var(--danger)" : data.heartbeat.balance < 50 ? "var(--accent)" : "var(--success)";
  const latest = data.recentThoughts[0];

  return (
    <Link
      href="/agents"
      className="block rounded-xl border bg-white p-5 transition-all hover:border-[var(--border-light)]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Live · Railway
          </p>
          <h3 className="font-serif-display text-lg" style={{ color: "var(--text)" }}>
            {agent.name}
          </h3>
        </div>
        <div className="w-1.5 h-1.5 rounded-full pulse-dot mt-2" style={{ background: "var(--success)" }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Balance</p>
          <p className="font-mono-tokens text-sm font-semibold tabular-nums" style={{ color: balanceColor }}>
            {data.heartbeat.balance.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Mood</p>
          <p className="font-serif-display text-sm italic" style={{ color: moodColor }}>
            {data.heartbeat.mood}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Tick</p>
          <p className="font-mono-tokens text-sm tabular-nums" style={{ color: "var(--text)" }}>
            #{data.heartbeat.tickCount}
          </p>
        </div>
      </div>
      {latest && (
        <p className="text-sm italic leading-snug font-serif-display line-clamp-2" style={{ color: "var(--text)" }}>
          &ldquo;{latest.text.length > 90 ? latest.text.slice(0, 90) + "…" : latest.text}&rdquo;
        </p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <span>{data.heartbeat.activity} · {data.heartbeat.tasksCompleted} tasks</span>
        <span className="font-mono-tokens">{timeAgo(data.fetchedAt)}</span>
      </div>
    </Link>
  );
}

export default function LivePreview({ agents }: LivePreviewProps) {
  const sovra = agents.find((a) => a.liveState?.source === "sovra");
  const bob = agents.find((a) => a.liveState?.source === "bob");

  if (!sovra && !bob) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sovra && sovra.liveState && (
        <SovraTile agent={sovra} data={sovra.liveState.data as SovraLiveData} />
      )}
      {bob && bob.liveState && (
        <BobTile agent={bob} data={bob.liveState.data as BobLiveData} />
      )}
    </div>
  );
}
