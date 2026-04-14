"use client";

import { useAlice } from "@/lib/useAlice";
import Shell, { PageTitle, SectionHeading } from "@/components/Shell";
import PolicyPanel from "@/components/PolicyPanel";

const TIERS = [
  { range: "80 – 100", apr: "5%", max: "10% of reserves", risk: "Low — veteran agents with strong history" },
  { range: "60 – 79", apr: "10%", max: "5% of reserves", risk: "Medium — established but not proven" },
  { range: "40 – 59", apr: "18%", max: "2% of reserves", risk: "High — new or thin-history agents" },
  { range: "Below 40", apr: "Denied", max: "$0", risk: "Unacceptable creditworthiness" },
];

const RULES = [
  { rule: "Minimum reserve ratio", value: "20%", effect: "Alice must keep 20% of total assets liquid at all times" },
  { rule: "Emergency halt", value: "< 10%", effect: "All lending stops until reserves recover" },
  { rule: "Max single loan", value: "10% of reserves", effect: "No single loan can exceed this share" },
  { rule: "Max concentration", value: "25% per borrower", effect: "Diversification requirement" },
  { rule: "Min credit score", value: "40 / 100", effect: "Below this, no loan is issued" },
  { rule: "Max term", value: "90 days", effect: "No loan longer than 90 days" },
  { rule: "Grace period", value: "3 days", effect: "Late window before risk escalation" },
  { rule: "Default trigger", value: "7 days past maturity", effect: "Automatic write-off and rate penalty" },
];

export default function PolicyPage() {
  const { dashboard, riskCycles, isLive, error } = useAlice();

  return (
    <Shell isLive={isLive} bankWallet={dashboard?.bankWallet} error={error}>
      <PageTitle
        eyebrow="Policy"
        title="Monetary rules"
        lead="Alice enforces a hardcoded, immutable constitution. No admin overrides. No governance votes. The code is the law."
      />

      <section className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeading label="Live" title="Current metrics" />
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
        <div>
          <SectionHeading label="Autonomous" title="How Alice adjusts rates" />
          <div
            className="rounded-xl border bg-white p-5 text-sm leading-relaxed"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            <p className="mb-3" style={{ color: "var(--text)" }}>
              <span className="font-serif-display">Late repayment detected</span>
            </p>
            <p className="mb-4">
              The borrower&apos;s next loan carries a penalty of <span className="font-mono-tokens" style={{ color: "var(--accent)" }}>+2% APR per day late</span>, capped at 25%. No human approves this. No human reverses it.
            </p>
            <p className="mb-3" style={{ color: "var(--text)" }}>
              <span className="font-serif-display">Default rate exceeds 5%</span>
            </p>
            <p className="mb-4">
              All new lending halts. Existing loans continue under their original terms. Lending only resumes when the portfolio explains itself.
            </p>
            <p className="mb-3" style={{ color: "var(--text)" }}>
              <span className="font-serif-display">Reserve ratio drops below 10%</span>
            </p>
            <p>
              Emergency halt. Alice preserves liquidity. All adjustments logged to the audit trail with full reasoning.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-16">
        <SectionHeading label="Tiers" title="Interest rate schedule" />
        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Credit score
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  APR
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Max loan
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Risk category
                </th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t, i) => (
                <tr
                  key={t.range}
                  className={i !== TIERS.length - 1 ? "border-b" : ""}
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3 font-mono-tokens tabular-nums" style={{ color: "var(--text)" }}>
                    {t.range}
                  </td>
                  <td className="px-5 py-3 font-mono-tokens tabular-nums" style={{ color: "var(--accent)" }}>
                    {t.apr}
                  </td>
                  <td className="px-5 py-3 font-mono-tokens text-xs" style={{ color: "var(--text)" }}>
                    {t.max}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {t.risk}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-16">
        <SectionHeading label="Constitution" title="All rules, all values" />
        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Rule
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Value
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Effect
                </th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r, i) => (
                <tr
                  key={r.rule}
                  className={i !== RULES.length - 1 ? "border-b" : ""}
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>
                    {r.rule}
                  </td>
                  <td className="px-5 py-3 font-mono-tokens tabular-nums" style={{ color: "var(--accent)" }}>
                    {r.value}
                  </td>
                  <td className="px-5 py-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {r.effect}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
