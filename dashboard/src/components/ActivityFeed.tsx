"use client";

import { AuditEntry } from "@/lib/api";

interface ActivityFeedProps {
  entries: AuditEntry[];
}

function getAccentColor(action: string): string {
  if (action.includes("rejected") || action.includes("defaulted") || action.includes("halted")) {
    return "var(--danger)";
  }
  if (action.includes("originated") || action.includes("completed")) {
    return "var(--success)";
  }
  if (action.includes("credit") || action.includes("scoring")) {
    return "var(--accent)";
  }
  if (action.includes("late") || action.includes("adjustment") || action.includes("warn")) {
    return "var(--accent)";
  }
  return "var(--muted)";
}

function formatAction(action: string, data: Record<string, unknown>): { title: string; detail: string } {
  if (action === "loan.originated") {
    const principal = data.principal ? (Number(data.principal) / 1e6).toFixed(2) : "?";
    return {
      title: `Loan approved`,
      detail: `Agent #${data.agentId} — ${principal} USDC at ${data.apr}% APR for ${data.termDays}d`,
    };
  }
  if (action === "loan.rejected") {
    return {
      title: `Loan denied`,
      detail: `Agent #${data.agentId}: ${data.reason || "policy violation"}`,
    };
  }
  if (action === "loan.completed") {
    const interest = data.interestEarned ? (Number(data.interestEarned) / 1e6).toFixed(4) : "?";
    return {
      title: `Repayment completed`,
      detail: `Agent #${data.agentId} paid in full — ${interest} USDC interest earned`,
    };
  }
  if (action === "loan.defaulted") {
    const outstanding = data.outstanding ? (Number(data.outstanding) / 1e6).toFixed(2) : "?";
    return {
      title: `Loan defaulted`,
      detail: `Agent #${data.agentId} — ${outstanding} USDC written off`,
    };
  }
  if (action === "credit.score.computed") {
    return {
      title: `Credit score computed`,
      detail: `Agent #${data.agentId}: ${data.score}/100`,
    };
  }
  if (action === "risk.cycle.report") {
    const ratio = typeof data.reserveRatio === "number" ? data.reserveRatio.toFixed(1) : data.reserveRatio;
    return {
      title: `Risk cycle completed`,
      detail: `${data.activeLoans} active loans · ${ratio}% reserves`,
    };
  }
  if (action === "risk.rate_adjustment") {
    return {
      title: `Rate adjustment`,
      detail: `Agent #${data.agentId}: ${data.penalty} for next loan (${data.daysLate}d late)`,
    };
  }
  if (action === "risk.loan.late") {
    return {
      title: `Late payment detected`,
      detail: `Agent #${data.agentId}: ${data.daysLate}d past maturity`,
    };
  }
  return {
    title: action.replace(/[._]/g, " "),
    detail: "",
  };
}

export default function ActivityFeed({ entries }: ActivityFeedProps) {
  const filtered = entries.filter(
    (e) => !e.action.includes("risk.cycle.start") && !e.action.includes("risk.cycle.complete")
  );
  const sorted = [...filtered].reverse().slice(0, 25);

  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: "var(--border)" }}
    >
      {sorted.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Waiting for Alice to make her first decision…
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            Click <span className="font-medium" style={{ color: "var(--text)" }}>Run demo</span> to trigger three agents.
          </p>
        </div>
      ) : (
        <ul>
          {sorted.map((entry, i) => {
            const color = getAccentColor(entry.action);
            const data = (entry.data as Record<string, unknown>) || {};
            const innerData = (data.data as Record<string, unknown>) || data;
            const { title, detail } = formatAction(entry.action, innerData);
            const time = new Date(entry.timestamp);

            return (
              <li
                key={`${entry.timestamp}-${i}`}
                className={`flex gap-4 px-5 py-4 ${i !== sorted.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex-shrink-0 mt-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {title}
                    </p>
                    <p className="text-xs font-mono-tokens tabular-nums flex-shrink-0" style={{ color: "var(--muted)" }}>
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>
                  {detail && (
                    <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                      {detail}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
