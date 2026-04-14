"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDashboard,
  fetchAuditLog,
  fetchRegistry,
  Dashboard,
  AuditEntry,
  RegisteredAgentData,
} from "./api";

const POLL_INTERVAL = 2000;

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

  const refresh = useCallback(async () => {
    try {
      const [dash, audit, registry] = await Promise.all([
        fetchDashboard(),
        fetchAuditLog(150),
        fetchRegistry(),
      ]);
      setDashboard(dash);
      setAuditEntries(audit.entries);
      setRiskCycles(audit.riskCycles);
      setRegistryAgents(registry.agents);
      setIsLive(true);
      setError(null);
    } catch (err) {
      setIsLive(false);
      setError(err instanceof Error ? err.message : "Connection failed");
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
