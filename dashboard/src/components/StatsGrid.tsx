"use client";

import { formatUSD } from "@/lib/api";

interface StatsGridProps {
  reserves: number;
  deployed: number;
  available: number;
  interestEarned: number;
  weightedAPR: number;
  avgScore: number;
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="p-5 rounded-xl border bg-white"
      style={{ borderColor: "var(--border)" }}
    >
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="font-mono-tokens text-2xl tabular-nums" style={{ color: "var(--text)" }}>
        {value}
      </p>
      {hint && (
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function StatsGrid({
  reserves,
  deployed,
  available,
  interestEarned,
  weightedAPR,
  avgScore,
}: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card label="Total reserves" value={formatUSD(reserves)} hint="USDC held by Alice" />
      <Card label="Deployed" value={formatUSD(deployed)} hint="Outstanding loans" />
      <Card label="Available" value={formatUSD(available)} hint="Capital for new loans" />
      <Card label="Interest earned" value={formatUSD(interestEarned)} hint="Yield to depositors" />
      <Card label="Weighted APR" value={`${weightedAPR.toFixed(1)}%`} hint="Across active loans" />
      <Card label="Avg credit score" value={`${avgScore} / 100`} hint="Of active borrowers" />
    </div>
  );
}
