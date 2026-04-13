"use client";

import { AuditEntry } from "@/lib/api";

interface ActivityFeedProps {
  entries: AuditEntry[];
}

function getEntryColor(action: string): string {
  if (action.includes("rejected") || action.includes("defaulted") || action.includes("halted")) return "#EF4444";
  if (action.includes("originated") || action.includes("completed")) return "#10B981";
  if (action.includes("credit") || action.includes("compute")) return "#8B5CF6";
  if (action.includes("repayment")) return "#34D399";
  if (action.includes("late") || action.includes("warn")) return "#F59E0B";
  return "#94A3B8";
}

function getEntryIcon(action: string): string {
  if (action.includes("rejected")) return "X";
  if (action.includes("originated")) return "$";
  if (action.includes("completed")) return "\u2713";
  if (action.includes("defaulted")) return "!";
  if (action.includes("credit")) return "\u2605";
  if (action.includes("repayment")) return "\u21B5";
  if (action.includes("risk")) return "\u25B2";
  return "\u2022";
}

function formatAction(action: string, data: Record<string, unknown>): string {
  if (action === "loan.originated") {
    return `Loan approved for Agent #${data.agentId} — ${data.principal ? (Number(data.principal) / 1e6).toFixed(2) : "?"} USDC @ ${data.apr}% APR`;
  }
  if (action === "loan.rejected") {
    return `Denied Agent #${data.agentId}: ${data.reason || "policy violation"}`;
  }
  if (action === "loan.completed") {
    return `Loan repaid by Agent #${data.agentId} — interest earned: ${data.interestEarned ? (Number(data.interestEarned) / 1e6).toFixed(4) : "?"} USDC`;
  }
  if (action === "loan.defaulted") {
    return `DEFAULT: Agent #${data.agentId} — ${data.outstanding ? (Number(data.outstanding) / 1e6).toFixed(2) : "?"} USDC outstanding`;
  }
  if (action === "credit.score.computed") {
    return `Credit score computed for Agent #${data.agentId}: ${data.score}/100`;
  }
  if (action === "risk.cycle.report") {
    return `Risk cycle: ${data.activeLoans} active loans, reserve ratio ${typeof data.reserveRatio === "number" ? data.reserveRatio.toFixed(1) : data.reserveRatio}%`;
  }
  return action.replace(/\./g, " ");
}

export default function ActivityFeed({ entries }: ActivityFeedProps) {
  const sorted = [...entries].reverse().slice(0, 30);

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 h-full">
      <h3 className="text-sm uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#10B981] pulse-dot" />
        Live Activity Feed
      </h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {sorted.length === 0 ? (
          <p className="text-[#94A3B8] text-sm italic">Waiting for activity...</p>
        ) : (
          sorted.map((entry, i) => {
            const color = getEntryColor(entry.action);
            const icon = getEntryIcon(entry.action);
            const data = (entry.data as Record<string, unknown>) || {};
            // Extract nested data if present
            const innerData = (data.data as Record<string, unknown>) || data;
            return (
              <div key={`${entry.timestamp}-${i}`} className="flex items-start gap-2 text-sm">
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ backgroundColor: color + "20", color }}
                >
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[#F1F5F9] truncate">{formatAction(entry.action, innerData)}</p>
                  <p className="text-[#64748B] text-xs">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
