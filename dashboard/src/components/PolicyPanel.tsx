"use client";

import { RiskMetrics } from "@/lib/api";

interface PolicyPanelProps {
  metrics: RiskMetrics;
  riskCycles: number;
}

export default function PolicyPanel({ metrics, riskCycles }: PolicyPanelProps) {
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
      <h3 className="text-sm uppercase tracking-wider text-[#94A3B8] mb-3">
        Monetary Policy
      </h3>

      <div className="space-y-3">
        {/* Lending Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94A3B8]">Lending Status</span>
          <span
            className={`text-sm font-semibold px-2 py-0.5 rounded ${
              metrics.lendingHalted
                ? "bg-[#EF4444]/20 text-[#EF4444]"
                : "bg-[#10B981]/20 text-[#10B981]"
            }`}
          >
            {metrics.lendingHalted ? "HALTED" : "ACTIVE"}
          </span>
        </div>

        {/* Reserve Ratio */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#94A3B8]">Reserve Ratio</span>
            <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {metrics.reserveRatio.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-[#1E293B] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(metrics.reserveRatio, 100)}%`,
                backgroundColor: metrics.reserveRatio < 20 ? "#EF4444" : metrics.reserveRatio < 50 ? "#F59E0B" : "#10B981",
              }}
            />
          </div>
        </div>

        {/* Default Rate */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94A3B8]">Default Rate</span>
          <span
            className="text-sm tabular-nums"
            style={{
              fontFamily: "var(--font-mono)",
              color: metrics.defaultRate > 5 ? "#EF4444" : metrics.defaultRate > 2 ? "#F59E0B" : "#10B981",
            }}
          >
            {metrics.defaultRate.toFixed(1)}%
          </span>
        </div>

        {/* Avg Credit Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94A3B8]">Avg Credit Score</span>
          <span className="text-sm tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
            {metrics.averageCreditScore}/100
          </span>
        </div>

        {/* Concentration Risk */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94A3B8]">Concentration</span>
          <span className="text-sm tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
            {metrics.concentrationRisk.toFixed(1)}%
          </span>
        </div>

        {/* Risk Cycles */}
        <div className="flex items-center justify-between border-t border-[#1E293B] pt-2 mt-2">
          <span className="text-sm text-[#94A3B8]">Risk Cycles</span>
          <span className="text-sm tabular-nums text-[#8B5CF6]" style={{ fontFamily: "var(--font-mono)" }}>
            {riskCycles}
          </span>
        </div>

        {metrics.haltReason && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded p-2 mt-2">
            <p className="text-xs text-[#EF4444]">{metrics.haltReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
