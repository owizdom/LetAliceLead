"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuditEntry } from "@/lib/api";

interface SignalLoomProps {
  entries: AuditEntry[];
}

// The 7 Locus wrapped APIs Alice uses for credit scoring
const PROVIDERS = [
  { id: "exa", label: "exa", description: "Semantic identity search" },
  { id: "firecrawl", label: "firecrawl", description: "On-chain wallet scrape" },
  { id: "brave", label: "brave", description: "Background verification" },
  { id: "perplexity", label: "perplexity", description: "AI reasoning" },
  { id: "coingecko", label: "coingecko", description: "Market context" },
  { id: "tavily", label: "tavily", description: "AI-optimized search" },
  { id: "alphavantage", label: "alphavantage", description: "Financial context" },
] as const;

interface Pulse {
  id: string;
  timestamp: number;
  success: boolean;
}

interface ProviderStats {
  count: number;
  p50Latency: number;
  lastSeen: number;
}

export default function SignalLoom({ entries }: SignalLoomProps) {
  const seenIdsRef = useRef<Set<number>>(new Set());
  const [pulses, setPulses] = useState<Record<string, Pulse[]>>({});

  // Group API call events by provider
  const stats = useMemo<Record<string, ProviderStats>>(() => {
    const result: Record<string, ProviderStats> = {};
    for (const p of PROVIDERS) {
      result[p.id] = { count: 0, p50Latency: 0, lastSeen: 0 };
    }
    for (const entry of entries) {
      if (!entry.action.startsWith("locus.api.")) continue;
      const match = entry.action.match(/^locus\.api\.([^.]+)\.called$/);
      if (!match) continue;
      const provider = match[1];
      if (!result[provider]) continue;
      const data = (entry.data as Record<string, unknown>) || {};
      const inner = (data.data as Record<string, unknown>) || data;
      const latency = typeof inner.latencyMs === "number" ? inner.latencyMs : 0;
      result[provider].count += 1;
      result[provider].p50Latency = result[provider].p50Latency
        ? (result[provider].p50Latency + latency) / 2
        : latency;
      if (entry.timestamp > result[provider].lastSeen) {
        result[provider].lastSeen = entry.timestamp;
      }
    }
    return result;
  }, [entries]);

  // Detect new events and fire pulses
  useEffect(() => {
    const newPulses: Record<string, Pulse[]> = {};
    for (const entry of entries) {
      if (!entry.action.startsWith("locus.api.")) continue;
      if (seenIdsRef.current.has(entry.timestamp)) continue;
      const match = entry.action.match(/^locus\.api\.([^.]+)\.called$/);
      if (!match) continue;
      const provider = match[1];
      if (!PROVIDERS.find((p) => p.id === provider)) continue;

      const data = (entry.data as Record<string, unknown>) || {};
      const inner = (data.data as Record<string, unknown>) || data;
      const success = inner.success !== false;

      seenIdsRef.current.add(entry.timestamp);
      if (!newPulses[provider]) newPulses[provider] = [];
      newPulses[provider].push({
        id: `${provider}-${entry.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: entry.timestamp,
        success,
      });
    }

    if (Object.keys(newPulses).length > 0) {
      setPulses((prev) => {
        const next = { ...prev };
        for (const [provider, list] of Object.entries(newPulses)) {
          next[provider] = [...(next[provider] || []), ...list];
        }
        return next;
      });

      // Auto-cleanup pulses after animation (1.5s)
      setTimeout(() => {
        setPulses((prev) => {
          const next = { ...prev };
          for (const provider of Object.keys(newPulses)) {
            next[provider] = (next[provider] || []).filter(
              (p) => !newPulses[provider].some((np) => np.id === p.id)
            );
          }
          return next;
        });
      }, 1500);
    }
  }, [entries]);

  const totalCalls = Object.values(stats).reduce((sum, s) => sum + s.count, 0);

  return (
    <div
      className="rounded-xl border bg-white p-6 sm:p-8"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-baseline justify-between mb-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Locus wrapped APIs
          </p>
          <p className="font-serif-display text-lg" style={{ color: "var(--text)" }}>
            Alice&apos;s underwriting signal
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Total calls
          </p>
          <p className="font-mono-tokens text-lg tabular-nums" style={{ color: "var(--text)" }}>
            {totalCalls}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const providerStats = stats[provider.id];
          const activePulses = pulses[provider.id] || [];
          const isActive = activePulses.length > 0;
          const hasHistory = providerStats.count > 0;

          return (
            <div key={provider.id} className="group">
              <div className="flex items-center gap-4">
                {/* Label */}
                <div className="w-28 sm:w-32 flex-shrink-0">
                  <p
                    className="font-serif-display text-sm leading-tight"
                    style={{ color: isActive ? "var(--accent)" : hasHistory ? "var(--text)" : "var(--muted)" }}
                  >
                    {provider.label}
                  </p>
                </div>

                {/* Ribbon */}
                <div className="flex-1 relative">
                  <Ribbon isActive={isActive} pulses={activePulses} />
                </div>

                {/* Stats */}
                <div className="flex items-baseline gap-3 flex-shrink-0 w-36 justify-end">
                  <span
                    className="font-mono-tokens text-xs tabular-nums"
                    style={{ color: hasHistory ? "var(--text)" : "var(--muted)" }}
                  >
                    {hasHistory ? formatLatency(providerStats.p50Latency) : "—"}
                  </span>
                  <span
                    className="font-mono-tokens text-xs tabular-nums w-10 text-right"
                    style={{ color: "var(--muted)" }}
                  >
                    {providerStats.count}
                  </span>
                </div>
              </div>
              <p className="text-xs mt-1 ml-32 sm:ml-36" style={{ color: "var(--muted)" }}>
                {provider.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Every credit score fires 7 pulses — one per Locus wrapped API. Latency and count shown per thread.
        </p>
      </div>
    </div>
  );
}

function Ribbon({ isActive, pulses }: { isActive: boolean; pulses: Pulse[] }) {
  return (
    <div className="relative h-4 flex items-center">
      {/* Base ribbon line */}
      <div
        className="absolute left-0 right-0 h-px transition-colors"
        style={{ background: isActive ? "var(--accent)" : "var(--border-light)", opacity: isActive ? 0.3 : 1 }}
      />

      {/* Tick marks */}
      {[0.25, 0.5, 0.75].map((pos) => (
        <div
          key={pos}
          className="absolute w-px h-1.5"
          style={{
            left: `${pos * 100}%`,
            background: "var(--border-light)",
          }}
        />
      ))}

      {/* Pulses */}
      <AnimatePresence>
        {pulses.map((pulse) => (
          <motion.div
            key={pulse.id}
            initial={{ left: "0%", opacity: 0 }}
            animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", times: [0, 0.1, 0.9, 1] }}
            className="absolute"
            style={{
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: pulse.success ? "var(--accent)" : "var(--danger)",
              boxShadow: `0 0 12px ${pulse.success ? "var(--accent)" : "var(--danger)"}`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
