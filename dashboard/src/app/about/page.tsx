"use client";

import { useAlice } from "@/lib/useAlice";
import Shell, { PageTitle, SectionHeading } from "@/components/Shell";

const LOCUS_PRIMITIVES = [
  { use: "Check treasury reserves", api: "GET /api/pay/balance", without: "Alice doesn't know how much she can lend" },
  { use: "Disburse USDC loans", api: "POST /api/pay/send", without: "No money moves — loans are just database entries" },
  { use: "Verify borrower repayment", api: "GET /api/pay/transactions", without: "Alice can't confirm payments, can't close loans" },
  { use: "Score agent reputation", api: "POST /api/wrapped/brave/web-search", without: "No background checks — blind lending" },
  { use: "Score on-chain activity", api: "POST /api/wrapped/firecrawl/scrape", without: "Can't see wallet history on BaseScan" },
  { use: "AI creditworthiness analysis", api: "POST /api/wrapped/perplexity/chat", without: "No sentiment analysis, no reasoning" },
  { use: "Semantic identity search", api: "POST /api/wrapped/exa/search", without: "Can't find agent's web presence" },
  { use: "Market context for risk", api: "POST /api/wrapped/coingecko/simple-price", without: "Lending blind to market conditions" },
];

const SCORING = [
  { factor: "Identity", range: "0 – 34", signals: "Agent age, metadata completeness, wallet status" },
  { factor: "Reputation", range: "0 – 33", signals: "Feedback count, sentiment ratio, unique interactions, recent trend" },
  { factor: "Financial", range: "0 – 33", signals: "Wallet balance, inflow consistency, transaction activity, debt ratio" },
];

export default function AboutPage() {
  const { dashboard, isLive, error } = useAlice();

  return (
    <Shell isLive={isLive} bankWallet={dashboard?.bankWallet} error={error}>
      <PageTitle
        eyebrow="About"
        title="Alice, Governor of the Agent Central Bank"
        lead="An autonomous financial institution for AI agents — underwriting, risk pricing, and monetary policy, powered entirely by PayWithLocus."
      />

      <section className="mb-16">
        <SectionHeading label="Problem" title="The AI economy is stuck in the 1600s" />
        <div
          className="rounded-xl border bg-white p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text)" }}>
            AI agents carry wallets but can&apos;t get capital. An agent spots a 40% arbitrage opportunity — it can&apos;t borrow a dollar to capture it. A research agent needs $2 of API calls to complete a task — it has no credit line. Meanwhile, your USDC sits earning nothing.
          </p>
          <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>
            There&apos;s no credit market for machines. No underwriting. No risk pricing. No lender of last resort. Alice fixes this — she&apos;s an autonomous central bank that evaluates agent borrowers, prices risk, issues USDC loans, and enforces repayment. All through PayWithLocus.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <SectionHeading label="Mechanism" title="How Alice scores an agent" />
        <p className="text-sm mb-6 max-w-3xl leading-relaxed" style={{ color: "var(--muted)" }}>
          Every credit score combines three factors totaling 0–100. Data comes from 7 Locus wrapped APIs. Scoring is deterministic (LLM with temperature 0, seed 42) with an algorithmic fallback.
        </p>
        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Factor
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Range
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Signals
                </th>
              </tr>
            </thead>
            <tbody>
              {SCORING.map((s, i) => (
                <tr
                  key={s.factor}
                  className={i !== SCORING.length - 1 ? "border-b" : ""}
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3 font-serif-display font-medium" style={{ color: "var(--text)" }}>
                    {s.factor}
                  </td>
                  <td className="px-5 py-3 font-mono-tokens tabular-nums" style={{ color: "var(--accent)" }}>
                    {s.range}
                  </td>
                  <td className="px-5 py-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {s.signals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-16">
        <SectionHeading label="Dependency" title="Why Alice cannot work without PayWithLocus" />
        <p className="text-sm mb-6 max-w-3xl leading-relaxed" style={{ color: "var(--muted)" }}>
          PayWithLocus isn&apos;t bolted on — it&apos;s Alice&apos;s entire nervous system. Every core function maps to a Locus primitive.
        </p>
        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  What Alice does
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Locus API
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Without it
                </th>
              </tr>
            </thead>
            <tbody>
              {LOCUS_PRIMITIVES.map((p, i) => (
                <tr
                  key={p.use}
                  className={i !== LOCUS_PRIMITIVES.length - 1 ? "border-b" : ""}
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3" style={{ color: "var(--text)" }}>
                    {p.use}
                  </td>
                  <td className="px-5 py-3 font-mono-tokens text-xs" style={{ color: "var(--accent)" }}>
                    {p.api}
                  </td>
                  <td className="px-5 py-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {p.without}
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
