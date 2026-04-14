"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AuditEntry } from "@/lib/api";

interface ActivityFeedProps {
  entries: AuditEntry[];
}

const MAX_VISIBLE = 7;

function getAccentColor(action: string): string {
  if (action === "alice.action.margin_call" || action === "collateral.ltv.changed") {
    return "var(--rose-deep, var(--danger))";
  }
  if (action === "sovra.bid.placed") {
    return "var(--sky-deep, var(--accent))";
  }
  if (action === "sovra.bid.intent") {
    return "var(--accent)";
  }
  if (action === "alice.action.promote_via_sovra") {
    return "var(--accent-deep, var(--accent))";
  }
  if (action === "collateral.pledged" || action === "collateral.priced") {
    return "var(--sky-deep, var(--accent))";
  }
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

function formatAction(action: string, data: Record<string, unknown>): { title: string; detail: string } | null {
  if (action === "loan.originated") {
    const principal = data.principal ? (Number(data.principal) / 1e6).toFixed(2) : "?";
    return {
      title: `Loan approved`,
      detail: `Agent #${data.agentId} · ${principal} USDC · ${data.apr}% APR`,
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
      title: `Repayment complete`,
      detail: `Agent #${data.agentId} · +${interest} USDC interest`,
    };
  }
  if (action === "loan.defaulted") {
    const outstanding = data.outstanding ? (Number(data.outstanding) / 1e6).toFixed(2) : "?";
    return {
      title: `Default`,
      detail: `Agent #${data.agentId} · ${outstanding} USDC written off`,
    };
  }
  if (action === "credit.score.computed") {
    return {
      title: `Score computed`,
      detail: `Agent #${data.agentId}: ${data.score}/100`,
    };
  }
  if (action === "risk.rate_adjustment") {
    return {
      title: `Rate adjusted`,
      detail: `Agent #${data.agentId} · ${data.penalty} for next loan`,
    };
  }
  if (action === "risk.loan.late") {
    return {
      title: `Late payment`,
      detail: `Agent #${data.agentId} · ${data.daysLate}d past due`,
    };
  }
  if (action.startsWith("locus.api.") && action.endsWith(".called")) {
    const provider = action.replace("locus.api.", "").replace(".called", "");
    const latency = data.latencyMs ? `${data.latencyMs}ms` : "";
    return {
      title: `Locus call: ${provider}`,
      detail: latency,
    };
  }
  if (action === "marketplace.agent.state_changed") {
    const name = data.name as string | undefined;
    const state = data.state as string | undefined;
    const actionText = data.action as string | undefined;
    if (!name || !state) return null;
    return {
      title: `${name} · ${state.toLowerCase()}`,
      detail: actionText || "",
    };
  }
  // Hide noisy actions entirely
  return null;
}

export default function ActivityFeed({ entries }: ActivityFeedProps) {
  // Filter to only entries we want to surface, reverse to newest-first, cap
  const items = [...entries]
    .reverse()
    .map((entry) => {
      const data = (entry.data as Record<string, unknown>) || {};
      const innerData = (data.data as Record<string, unknown>) || data;
      const formatted = formatAction(entry.action, innerData);
      if (!formatted) return null;
      return {
        key: `${entry.timestamp}-${entry.action}`,
        timestamp: entry.timestamp,
        action: entry.action,
        ...formatted,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, MAX_VISIBLE);

  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: "var(--border)" }}
    >
      {items.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Waiting for activity…
          </p>
        </div>
      ) : (
        <ul className="relative">
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const color = getAccentColor(item.action);
              const time = new Date(item.timestamp);
              const isLatest = i === 0;

              return (
                <motion.li
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1 - i * 0.08, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={`flex gap-3 px-4 py-3 ${i !== items.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex-shrink-0 mt-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${isLatest ? "pulse-dot" : ""}`}
                      style={{ background: color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                        {item.title}
                      </span>
                      {item.detail && (
                        <span className="text-sm ml-2" style={{ color: "var(--muted)" }}>
                          {item.detail}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-mono-tokens tabular-nums flex-shrink-0"
                      style={{ color: "var(--muted)" }}
                    >
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
