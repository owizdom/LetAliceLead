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
        title="Alice — credit & procurement engine for autonomous agents"
        lead="An AI agent that procures creditworthiness data from 7 Locus wrapped APIs and issues USDC credit lines to other registered agents on Base. Two-sided agent-to-agent commerce."
      />

      <section className="mb-16">
        <SectionHeading label="Track fit" title="How this maps to Paygentic Week 1" />
        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Prompt example
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Match
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  What Alice does
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>
                  AI agents trading API calls
                </td>
                <td className="px-5 py-3 font-mono-tokens" style={{ color: "var(--accent)" }}>9 / 10</td>
                <td className="px-5 py-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  Every credit decision purchases 7 priced Locus wrapped APIs in real USDC (~$0.09/score). Every loan decision = 7 paid agent-to-agent calls.
                </td>
              </tr>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>
                  Automated procurement agents
                </td>
                <td className="px-5 py-3 font-mono-tokens" style={{ color: "var(--accent)" }}>7 / 10</td>
                <td className="px-5 py-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  Procures creditworthiness data from 7 vendors per underwrite under a hardcoded constitutional budget. Constitution = procurement policy.
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>
                  Business financial operations
                </td>
                <td className="px-5 py-3 font-mono-tokens" style={{ color: "var(--accent)" }}>6 / 10</td>
                <td className="px-5 py-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  Underwriting, treasury, repayment enforcement, default handling, autonomous rate adjustment, halt triggers — a full financial institution.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-16">
        <SectionHeading label="Loop" title="What Alice buys + sells" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
              Buys (per credit decision)
            </p>
            <p className="font-serif-display text-base mb-3" style={{ color: "var(--text)" }}>
              Data services from 7 Locus wrapped API providers
            </p>
            <ul className="text-sm space-y-1.5" style={{ color: "var(--muted)" }}>
              <li>· <span className="font-mono-tokens">exa</span> — semantic identity search</li>
              <li>· <span className="font-mono-tokens">firecrawl</span> — on-chain wallet scrape</li>
              <li>· <span className="font-mono-tokens">brave</span> — background verification</li>
              <li>· <span className="font-mono-tokens">perplexity</span> — AI reasoning</li>
              <li>· <span className="font-mono-tokens">coingecko</span> — market context</li>
              <li>· <span className="font-mono-tokens">tavily</span> — AI-optimized search</li>
              <li>· <span className="font-mono-tokens">alphavantage</span> — financial context</li>
            </ul>
            <p className="text-xs mt-4 pt-3 border-t" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
              Each call billed in real USDC to Alice&apos;s Locus wallet. Aggregate spend visible on Overview.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
              Sells (per registered agent)
            </p>
            <p className="font-serif-display text-base mb-3" style={{ color: "var(--text)" }}>
              USDC credit lines on Base
            </p>
            <ul className="text-sm space-y-1.5" style={{ color: "var(--muted)" }}>
              <li>· Risk-priced 5–18% APR (3-tier schedule)</li>
              <li>· Disbursed to the agent&apos;s Alice-issued managed wallet on Base</li>
              <li>· Auto-sweep at maturity for repayment</li>
              <li>· Constitutional caps: reserves ≥ 20%, single loan ≤ 10%, concentration ≤ 25%</li>
              <li>· Defaults written off at +7 days past maturity</li>
              <li>· Borrower rate adjusts on late repayment (+2% APR/day)</li>
            </ul>
            <p className="text-xs mt-4 pt-3 border-t" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
              Sovra and bobIsAlive are pre-registered. Anyone can register a new agent via POST /api/registry/register.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-16">
        <SectionHeading label="Problem" title="The AI economy has no credit primitive" />
        <div
          className="rounded-xl border bg-white p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text)" }}>
            AI agents carry wallets but can&apos;t get credit. An agent spots an opportunity — no working capital. A research agent needs $2 of API calls — no credit line. Meanwhile, depositors&apos; USDC sits earning nothing.
          </p>
          <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>
            Alice is the missing primitive. She procures the creditworthiness data she needs from Locus, scores any registered agent, and issues USDC credit lines on Base — autonomous on both sides of the trade.
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
