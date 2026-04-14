"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchDashboard,
  fetchAuditLog,
  fetchRegistry,
  Dashboard,
  AuditEntry,
  RegisteredAgentData,
} from "./api";

const POLL_INTERVAL = 2000;
// Only flip to "offline" after this many consecutive failures.
// At 2s cadence, 5 = 10s of sustained failure before banner appears.
const FAILURE_THRESHOLD = 5;

export interface AliceState {
  dashboard: Dashboard | null;
  auditEntries: AuditEntry[];
  registryAgents: RegisteredAgentData[];
  riskCycles: number;
  isLive: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAlice(): AliceState {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [registryAgents, setRegistryAgents] = useState<RegisteredAgentData[]>([]);
  const [riskCycles, setRiskCycles] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track consecutive failures per endpoint so transient blips don't trip the banner
  const failureStreak = useRef(0);

  const refresh = useCallback(async () => {
    // Fetch independently — a single failing endpoint shouldn't blank the whole dashboard
    const results = await Promise.allSettled([
      fetchDashboard(),
      fetchAuditLog(150),
      fetchRegistry(),
    ]);

    const [dashResult, auditResult, registryResult] = results;

    if (dashResult.status === "fulfilled") setDashboard(dashResult.value);
    if (auditResult.status === "fulfilled") {
      setAuditEntries(auditResult.value.entries);
      setRiskCycles(auditResult.value.riskCycles);
    }
    if (registryResult.status === "fulfilled") setRegistryAgents(registryResult.value.agents);

    const allFailed = results.every((r) => r.status === "rejected");
    const anyFailed = results.some((r) => r.status === "rejected");

    if (allFailed) {
      failureStreak.current += 1;
      if (failureStreak.current >= FAILURE_THRESHOLD) {
        setIsLive(false);
        const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        setError(firstErr?.reason instanceof Error ? firstErr.reason.message : "Connection failed");
      }
    } else {
      failureStreak.current = 0;
      setIsLive(true);
      setError(null);
      // Log partial failures to console but don't surface to user — last-known values remain on screen
      if (anyFailed) {
        const failed = results
          .map((r, i) => (r.status === "rejected" ? ["dashboard", "audit", "registry"][i] : null))
          .filter(Boolean);
        console.debug("[useAlice] partial fetch failure:", failed);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return { dashboard, auditEntries, registryAgents, riskCycles, isLive, error, refresh };
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
