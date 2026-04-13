"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDashboard,
  fetchAuditLog,
  Dashboard,
  AuditEntry,
  weiToUSDC,
} from "@/lib/api";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import StatsGrid from "@/components/StatsGrid";
import ActivityFeed from "@/components/ActivityFeed";
import PolicyPanel from "@/components/PolicyPanel";
import LoansTable from "@/components/LoansTable";
import Footer from "@/components/Footer";

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
    <div className="min-h-screen flex flex-col">
      <Header isLive={isLive} bankWallet={dashboard?.bankWallet} apiBase={API_BASE} />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16">

          {/* Hero */}
          <HeroSection
            totalYield={dashboard ? weiToUSDC(dashboard.portfolio.totalInterestEarned) : 0}
            totalReserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
          />

          {error && (
            <div className="mb-10 p-4 rounded-lg border" style={{ borderColor: "var(--danger)", background: "#FDF2F0" }}>
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                Cannot reach Alice: {error}. Start the server with <code className="font-mono-tokens px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--surface-2)" }}>cd alice &amp;&amp; npm run dev</code>
              </p>
            </div>
          )}

          <section className="mb-20">
            <SectionHeading label="Portfolio" title="Treasury & deployed capital" />
            <StatsGrid
              reserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
              deployed={dashboard ? weiToUSDC(dashboard.portfolio.deployedCapital) : 0}
              available={dashboard ? weiToUSDC(dashboard.portfolio.availableCapital) : 0}
              interestEarned={dashboard ? weiToUSDC(dashboard.portfolio.totalInterestEarned) : 0}
              weightedAPR={dashboard?.metrics.weightedAverageAPR ?? 0}
              avgScore={dashboard?.metrics.averageCreditScore ?? 0}
            />
          </section>

          <section className="mb-20 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SectionHeading label="Live" title="Activity feed" />
              <ActivityFeed entries={auditEntries} />
            </div>
            <div>
              <SectionHeading label="Policy" title="Monetary rules" />
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
          </section>

          <section className="mb-20">
            <SectionHeading label="Ledger" title={`Loan book (${allLoans.length})`} />
            <LoansTable loans={allLoans} />
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <h2 className="font-serif-display text-2xl tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
    </div>
  );
}
