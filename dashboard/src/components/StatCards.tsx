"use client";

import { formatUSD } from "@/lib/api";

interface StatCardsProps {
  reserves: number;
  deployed: number;
  available: number;
  weightedAPR: number;
  lendingHalted: boolean;
}

function Card({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">{label}</p>
      <p
        className="text-xl font-semibold tabular-nums"
        style={{ color: accent || "#F1F5F9", fontFamily: "var(--font-mono)" }}
      >
        {value}
      </p>
    </div>
  );
}

export default function StatCards({ reserves, deployed, available, weightedAPR, lendingHalted }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card label="Total Reserves" value={formatUSD(reserves)} />
      <Card label="Deployed Capital" value={formatUSD(deployed)} accent="#8B5CF6" />
      <Card label="Available" value={formatUSD(available)} accent="#10B981" />
      <Card
        label="Weighted APR"
        value={lendingHalted ? "HALTED" : `${weightedAPR.toFixed(1)}%`}
        accent={lendingHalted ? "#EF4444" : "#34D399"}
      />
    </div>
  );
}
