"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDashboard,
  fetchAuditLog,
  Dashboard,
  AuditEntry,
  weiToUSDC,
} from "@/lib/api";
import HeroYield from "@/components/HeroYield";
import StatCards from "@/components/StatCards";
import ActivityFeed from "@/components/ActivityFeed";
import PolicyPanel from "@/components/PolicyPanel";
import LoansTable from "@/components/LoansTable";
import DemoButton from "@/components/DemoButton";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const POLL_INTERVAL = 3000;

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [riskCycles, setRiskCycles] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [dash, audit] = await Promise.all([
        fetchDashboard(),
        fetchAuditLog(100),
      ]);
      setDashboard(dash);
      setAuditEntries(audit.entries);
      setRiskCycles(audit.riskCycles);
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

  const allLoans = dashboard
    ? [
        ...dashboard.portfolio.activeLoans,
        ...dashboard.portfolio.completedLoans,
        ...dashboard.portfolio.defaultedLoans,
      ]
    : [];

  return (
    <main className="min-h-screen p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span style={{ color: "#8B5CF6" }}>Let</span>
            <span>Alice</span>
            <span style={{ color: "#10B981" }}>Lead</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            The First Autonomous Central Bank for AI Agents
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DemoButton apiBase={API_BASE} />
          <div className="text-right text-xs text-[#64748B]">
            <p>Powered by <span className="text-[#10B981] font-semibold">PayWithLocus</span></p>
            {dashboard && (
              <p className="font-mono text-[#94A3B8]">
                {dashboard.bankWallet === "unknown"
                  ? "No wallet connected"
                  : `${dashboard.bankWallet.slice(0, 6)}...${dashboard.bankWallet.slice(-4)}`}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-[#EF4444]">
            Backend not reachable: {error}. Start the backend with <code className="bg-[#1E293B] px-1 rounded">npm run dev</code>
          </p>
        </div>
      )}

      {/* Hero Yield */}
      <HeroYield
        totalYield={dashboard ? weiToUSDC(dashboard.portfolio.totalInterestEarned) : 0}
        isLive={isLive}
      />

      {/* Stat Cards */}
      <div className="mb-6">
        <StatCards
          reserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
          deployed={dashboard ? weiToUSDC(dashboard.portfolio.deployedCapital) : 0}
          available={dashboard ? weiToUSDC(dashboard.portfolio.availableCapital) : 0}
          weightedAPR={dashboard?.metrics.weightedAverageAPR ?? 0}
          lendingHalted={dashboard?.metrics.lendingHalted ?? false}
        />
      </div>

      {/* Main Grid: Feed + Policy + Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Activity Feed - Left */}
        <div className="lg:col-span-5">
          <ActivityFeed entries={auditEntries} />
        </div>

        {/* Policy Panel - Center */}
        <div className="lg:col-span-3">
          <PolicyPanel
            metrics={
              dashboard?.metrics ?? {
                reserveRatio: 100,
                defaultRate: 0,
                averageCreditScore: 0,
                concentrationRisk: 0,
                totalExposure: "0",
                weightedAverageAPR: 0,
                lendingHalted: false,
                computedAt: Date.now(),
              }
            }
            riskCycles={riskCycles}
          />
        </div>

        {/* Loans Table - Right */}
        <div className="lg:col-span-4">
          <LoansTable loans={allLoans} />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-[#1E293B] text-center">
        <p className="text-xs text-[#64748B]">
          LetAliceLead v1.0.0 — Built for Locus Paygentic Hackathon #1
          {dashboard && ` — Uptime: ${Math.floor(dashboard.uptime / 1000)}s`}
        </p>
      </footer>
    </main>
  );
}
