<div align="center">

# LetAliceLead

**The first autonomous central bank for AI agents.**

*Alice runs an AI lending business. You keep the profits.*

<br />

[Demo](https://letalice.vercel.app) · [Devfolio](https://paygentic-week1.devfolio.co/) · [PayWithLocus](https://paywithlocus.com)

<br />

Built for **Locus Paygentic Hackathon #1** — Week 1: Using PayWithLocus

---

</div>

<br />

## The Problem

AI agents carry wallets but can't get capital. An agent spots a 40% arbitrage opportunity — it can't borrow a dollar to capture it. A research agent needs $2 of API calls to complete a task — it has no credit line. Meanwhile, your USDC sits in a wallet earning nothing, or you're lending it on Aave at 3% hoping humans show up.

There's no credit market for machines. No underwriting. No risk pricing. No lender of last resort.

**The AI economy is stuck in the 1600s — productive actors, zero access to liquidity.**

Alice fixes this.

<br />

## What LetAliceLead Does

Alice is an autonomous AI central bank that evaluates agent borrowers, prices risk, issues USDC loans, and enforces repayment — entirely through [PayWithLocus](https://paywithlocus.com).

You deposit USDC. Agents borrow. You earn **5–18% APR**. No manual management. No trust required.

### Three revenue streams

| Stream | How it works |
|--------|-------------|
| **Lending yield** | 5–18% APR on risk-adjusted loans to AI agents |
| **API arbitrage** | Alice buys Locus wrapped API calls at cost, resells to borrower agents at markup |
| **Credit reports** | Other agents and platforms pay for Alice's creditworthiness assessments |

<br />

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    LetAliceLead Dashboard                     │
│              (live yield counter, activity feed)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                        Alice (Agent)                         │
│                                                              │
│   Credit Scoring ──→ Loan Manager ──→ Treasury               │
│        │                   │              │                   │
│   10+ Locus APIs      Constitutional   Risk Monitor          │
│   (Exa, Firecrawl,    Enforcement     (auto-defaults,        │
│    Brave, Perplexity,  (reserves,      rate adjustment,       │
│    CoinGecko)          limits, tiers)  halt conditions)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                      PayWithLocus                            │
│                                                              │
│   /api/pay/send         Loan disbursement (USDC on Base)     │
│   /api/pay/balance      Treasury reserve monitoring          │
│   /api/pay/transactions Repayment verification               │
│   /api/wrapped/*        Credit data (10+ providers)          │
│   /api/x402/agentmail   Loan notifications via email         │
│   Policy guardrails     Spending limits, approval thresholds │
└──────────────────────────────────────────────────────────────┘
```

### Step by step

1. **Deposit** — User sends USDC to Alice's Locus wallet. Reserves update in real time.
2. **Application** — An AI agent requests a loan via `POST /api/loans/request` with its wallet address, amount, and purpose.
3. **Scoring** — Alice fetches the agent's identity, reputation, and financial data through Locus wrapped APIs (Exa for web presence, Firecrawl for on-chain activity, Brave for background, Perplexity for AI analysis, CoinGecko for market context). Produces a 0–100 credit score.
4. **Decision** — Constitutional rules engine checks: minimum score (40), reserve ratio (≥ 20%), single-loan cap (10% of reserves), concentration limit (25% per borrower). Alice approves or denies with a natural-language explanation.
5. **Disbursement** — On approval, USDC transfers to the borrower via `POST /api/pay/send` on Base.
6. **Monitoring** — Risk monitor runs every 60s. Checks maturity dates, repayment progress, and portfolio health. Auto-defaults loans 7 days past maturity.
7. **Repayment** — Borrower repays via `POST /api/loans/:id/repay`. Capital + interest returns to treasury. Yield counter ticks up.
8. **Rate Adjustment** — Alice autonomously adjusts rates for borrowers based on repayment behavior. Late? Higher rate next time.

<br />

## Locus Integration Depth

LetAliceLead uses **PayWithLocus as its entire nervous system** — not bolted on, essential.

### Payments

| Endpoint | Purpose |
|----------|---------|
| `POST /api/pay/send` | Disburse USDC loans to borrower wallets on Base |
| `GET /api/pay/balance` | Real-time treasury reserve monitoring |
| `GET /api/pay/transactions` | Verify incoming repayments by sender address |
| Policy guardrails | Allowance cap = credit limit, max tx = loan ceiling |

### Credit Scoring via Wrapped APIs

| Provider | What Alice uses it for |
|----------|----------------------|
| **Exa** | Semantic search for agent wallet reputation and history |
| **Firecrawl** | Scrape BaseScan for wallet activity, tx count, balances |
| **Brave Search** | Background verification and web presence scoring |
| **Perplexity** | AI-powered sentiment analysis and creditworthiness reasoning |
| **CoinGecko** | Market conditions and USDC stability context |

### Additional Services

| Feature | Endpoint |
|---------|----------|
| AgentMail | `POST /api/x402/agentmail-*` — loan confirmations, repayment reminders, default notices |
| Checkout | `GET /api/checkout/agent/*` — deposit onramp for users |

<br />

## Constitutional Rules

Alice enforces a hardcoded, immutable constitution. No overrides. No exceptions.

| Rule | Value | Why |
|------|-------|-----|
| Min reserve ratio | **20%** | Liquidity floor — Alice always has capital to lend |
| Emergency halt | **< 10%** | All lending stops until reserves recover |
| Max single loan | **10%** of reserves | No single borrower can drain the bank |
| Max concentration | **25%** per borrower | Diversification requirement |
| Min credit score | **40**/100 | Below this, you don't get a dollar |
| Grace period | **3 days** | Late window before risk escalation |
| Default trigger | **7 days** past maturity | Automatic write-off + reputation penalty |

### Interest Tiers

| Credit Score | APR | Max Loan (% of reserves) |
|-------------|-----|--------------------------|
| 80–100 | 5% | 10% |
| 60–79 | 10% | 5% |
| 40–59 | 18% | 2% |
| < 40 | **Denied** | — |

<br />

## Project Structure

```
LetAliceLead/
├── alice/                    The central bank agent
│   ├── src/
│   │   ├── locus/            PayWithLocus adapter, wrapped API scoring, audit
│   │   ├── core/             Credit scoring, loan manager, treasury, risk monitor
│   │   ├── api/              Express routes, middleware, demo agents
│   │   ├── constitution/     Enforceable lending rules and interest tiers
│   │   ├── adapters/         LLM inference (OpenAI-compatible)
│   │   ├── types/            TypeScript type definitions
│   │   └── utils/            Financial math, logging, crypto helpers
│   └── package.json
│
├── dashboard/                Live portfolio dashboard
│   ├── src/
│   │   ├── app/              Next.js app router, global styles
│   │   ├── components/       HeroYield, StatCards, ActivityFeed, PolicyPanel, LoansTable
│   │   └── lib/              API client, formatting utilities
│   └── package.json
│
├── soul/                     Alice's identity and operating procedures
│   ├── constitution.md       Enforceable rules (mirrored in code)
│   ├── soul.md               Agent identity and values
│   └── process.md            Decision-making procedures
│
├── .env.example              Environment configuration template
└── package.json              Workspace root
```

<br />

## API Reference

### Credit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/credit/apply` | Compute credit score for an agent. Body: `{ agentId, agentWallet }` |
| `GET` | `/api/credit/score/:agentId?wallet=0x...` | Quick score lookup |

### Loans

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/loans/request` | Apply for a loan. Body: `{ agentId, agentWallet, amount, purpose, termDays }` |
| `GET` | `/api/loans/:loanId` | Get loan status and repayment history |
| `POST` | `/api/loans/:loanId/repay` | Submit repayment. Body: `{ amount, txHash }` |
| `GET` | `/api/loans` | List all loans |

### Portfolio

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/portfolio` | Full dashboard: reserves, deployed, yield, all loans, risk metrics |
| `GET` | `/api/portfolio/metrics` | Risk metrics only: reserve ratio, default rate, concentration |
| `GET` | `/api/portfolio/audit` | Audit log of all Alice's decisions |

### Demo

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/demo/run` | Trigger 3 simulated agents (approved, approved, denied) |
| `GET` | `/api/demo/agents` | View demo agent profiles |

<br />

## Quick Start

```bash
# Clone
git clone https://github.com/owizdom/LetAliceLead.git
cd LetAliceLead

# Configure
cp .env.example alice/.env
# Add your LOCUS_API_KEY (get one at https://beta.paywithlocus.com)

# Start Alice (terminal 1)
cd alice && npm install && npm run dev

# Start dashboard (terminal 2)
cd dashboard && npm install && npm run dev
```

| Service | URL |
|---------|-----|
| Alice API | `http://localhost:3001` |
| Dashboard | `http://localhost:3000` |
| Health check | `http://localhost:3001/health` |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LOCUS_API_KEY` | Yes | PayWithLocus API key (`claw_xxx`) |
| `LOCUS_API_BASE` | No | API base URL (defaults to beta) |
| `OPENAI_API_KEY` | No | For LLM credit scoring (falls back to algorithmic) |
| `PORT` | No | Server port (default: 3001) |
| `RISK_CHECK_INTERVAL_MS` | No | Risk cycle interval (default: 60000) |

<br />

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Node.js, Express.js, TypeScript (strict) |
| Payments | PayWithLocus — USDC on Base |
| Credit data | Locus wrapped APIs (Exa, Firecrawl, Brave, Perplexity, CoinGecko) |
| LLM inference | OpenAI-compatible (gpt-4o-mini default) |
| Dashboard | Next.js 16, React 19, Tailwind CSS v4, Framer Motion |
| State | In-memory (loans, audit log) |

<br />

<div align="center">

---

**LetAliceLead** — Stop spending. Start lending.

Built by [wiz](https://github.com/owizdom)

</div>
