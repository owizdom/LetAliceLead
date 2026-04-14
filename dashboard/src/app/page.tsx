"use client";

import { useAlice } from "@/lib/useAlice";
import { weiToUSDC } from "@/lib/api";
import Shell, { SectionHeading } from "@/components/Shell";
import HeroSection from "@/components/HeroSection";
import FundBanner from "@/components/FundBanner";
import SignalLoom from "@/components/SignalLoom";
import StatsGrid from "@/components/StatsGrid";
import ActivityFeed from "@/components/ActivityFeed";

export default function OverviewPage() {
  const { dashboard, auditEntries, isLive, error } = useAlice();

  return (
    <Shell isLive={isLive} bankWallet={dashboard?.bankWallet} error={error}>
      <HeroSection
        totalYield={dashboard ? weiToUSDC(dashboard.portfolio.totalInterestEarned) : 0}
        totalReserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
      />

      <FundBanner
        bankWallet={dashboard?.bankWallet}
        reserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
      />

      <section className="mb-16">
        <SectionHeading label="Portfolio" title="Treasury at a glance" />
        <StatsGrid
          reserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
          deployed={dashboard ? weiToUSDC(dashboard.portfolio.deployedCapital) : 0}
          available={dashboard ? weiToUSDC(dashboard.portfolio.availableCapital) : 0}
          interestEarned={dashboard ? weiToUSDC(dashboard.portfolio.totalInterestEarned) : 0}
          weightedAPR={dashboard?.metrics.weightedAverageAPR ?? 0}
          avgScore={dashboard?.metrics.averageCreditScore ?? 0}
        />
      </section>

      <section className="mb-16">
        <SectionHeading label="Locus" title="Live wrapped-API signal" />
        <SignalLoom entries={auditEntries} />
      </section>

      <section className="mb-16">
        <SectionHeading label="Live" title="Recent activity" />
        <ActivityFeed entries={auditEntries} />
      </section>
    </Shell>
  );
}
