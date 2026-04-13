"use client";

import { RiskMetrics } from "@/lib/api";

interface PolicyPanelProps {
  metrics: RiskMetrics;
  riskCycles: number;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
      <span
        className="text-sm font-mono-tokens tabular-nums"
        style={{ color: accent || "var(--text)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function PolicyPanel({ metrics, riskCycles }: PolicyPanelProps) {
  const reserveColor =
    metrics.reserveRatio < 20 ? "var(--danger)" : metrics.reserveRatio < 50 ? "var(--accent)" : "var(--success)";

  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-sm" style={{ color: "var(--muted)" }}>Status</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: metrics.lendingHalted ? "#FDF2F0" : "var(--accent-soft)",
            color: metrics.lendingHalted ? "var(--danger)" : "var(--accent)",
          }}
        >
          {metrics.lendingHalted ? "HALTED" : "LENDING"}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm" style={{ color: "var(--muted)" }}>Reserve ratio</span>
          <span className="text-sm font-mono-tokens tabular-nums" style={{ color: reserveColor }}>
            {metrics.reserveRatio.toFixed(1)}%
          </span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--surface-3)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(metrics.reserveRatio, 100)}%`,
              background: reserveColor,
            }}
          />
        </div>
      </div>

      <div>
        <Row
          label="Default rate"
          value={`${metrics.defaultRate.toFixed(1)}%`}
          accent={metrics.defaultRate > 5 ? "var(--danger)" : undefined}
        />
        <Row label="Avg credit score" value={`${metrics.averageCreditScore} / 100`} />
        <Row label="Concentration" value={`${metrics.concentrationRisk.toFixed(1)}%`} />
        <Row label="Weighted APR" value={`${metrics.weightedAverageAPR.toFixed(1)}%`} />
        <Row label="Risk cycles" value={`${riskCycles}`} />
      </div>

      {metrics.haltReason && (
        <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "#FDF2F0", color: "var(--danger)" }}>
          {metrics.haltReason}
        </div>
      )}

      <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Alice enforces a hardcoded constitution. No overrides.
        </p>
      </div>
    </div>
  );
}
