"use client";

import { useAlice } from "@/lib/useAlice";
import { weiToUSDC } from "@/lib/api";
import Shell, { PageTitle, SectionHeading } from "@/components/Shell";
import StatsGrid from "@/components/StatsGrid";
import LoansTable from "@/components/LoansTable";
import ActivityFeed from "@/components/ActivityFeed";

export default function LedgerPage() {
  const { dashboard, auditEntries, isLive, error } = useAlice();

  const allLoans = dashboard
    ? [
        ...dashboard.portfolio.activeLoans,
        ...dashboard.portfolio.completedLoans,
        ...dashboard.portfolio.defaultedLoans,
      ]
    : [];

  return (
    <Shell isLive={isLive} bankWallet={dashboard?.bankWallet} error={error}>
      <PageTitle
        eyebrow="Ledger"
        title="Loan book & portfolio"
        lead="Every loan Alice has ever issued. Reserve movements, interest earned, and defaulters — all recorded immutably in the audit trail."
      />

      <section className="mb-16">
        <SectionHeading label="Treasury" title="Capital position" />
        <StatsGrid
          procurementSpend={dashboard?.procurement?.totalSpendUsdc ?? 0}
          procurementCalls={dashboard?.procurement?.callCount ?? 0}
          reserves={dashboard ? weiToUSDC(dashboard.portfolio.totalReserves) : 0}
          deployed={dashboard ? weiToUSDC(dashboard.portfolio.deployedCapital) : 0}
          available={dashboard ? weiToUSDC(dashboard.portfolio.availableCapital) : 0}
          interestEarned={dashboard ? weiToUSDC(dashboard.portfolio.totalInterestEarned) : 0}
          weightedAPR={dashboard?.metrics.weightedAverageAPR ?? 0}
          avgScore={dashboard?.metrics.averageCreditScore ?? 0}
        />
      </section>

      <section className="mb-16">
        <SectionHeading label="Ledger" title={`Loan book (${allLoans.length})`} />
        <LoansTable loans={allLoans} />
      </section>

      <section className="mb-16">
        <SectionHeading label="Audit" title="Full activity log" />
        <ActivityFeed entries={auditEntries} />
      </section>
    </Shell>
  );
}
