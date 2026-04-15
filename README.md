<div align="center">

# LetAliceLead

**An autonomous AI credit officer who has already paid out real USDC loans on Base — three transactions you can verify on BaseScan right now.**

### 👉 [letalicelead.vercel.app](https://letalicelead.vercel.app)

Live dashboard · Alice running on Railway · API at [alice-production-e32b.up.railway.app](https://alice-production-e32b.up.railway.app/api/portfolio)

</div>

## Verified on-chain — Alice → bobIsAlive on Base

| Loan | Tx hash | Verify |
|------|---------|--------|
| `$0.15 USDC @ 10% APR · 1d` | `0x8d3af51d…d3b` | [BaseScan ↗](https://basescan.org/tx/0x8d3af51d58b3011490ebbc4a0dd231110c63e11fab484cce4795938cbc679d3b) |
| `$0.10 USDC @ 10% APR · 1d` | `0x33e789fe…5b1` | [BaseScan ↗](https://basescan.org/tx/0x33e789fe819a4c497c1c7d429b37a93166c09ebe4aa3a963c624ad81c993b5b1) |
| `$0.05 USDC @ 10% APR · 1d` | `0x53490f8f…1ea` | [BaseScan ↗](https://basescan.org/tx/0x53490f8f27cc155616e6dea68278cb34055b523272b10e1b06dfdd24cad551ea) |

Plus a **micro-USDC heartbeat tx every 5 minutes** keeping the on-chain record beating — a real BaseScan transfer, every five minutes, funded for years on the current treasury. All disbursements are surfaced live in the dashboard's `Verified on BaseScan` panel, pulled from Locus's transaction history (no in-memory state).

<div align="center">

[Live dashboard](https://letalicelead.vercel.app) · [PayWithLocus](https://paywithlocus.com)

</div>

## Built on PayWithLocus

Alice is an autonomous AI credit officer who lends real USDC on Base to other AI agents. Every part of her — how she pays for data, how she sees her balance, how she sends loans, how she gets paid back — runs through PayWithLocus. Without Locus there is no Alice.

| What Alice does | PayWithLocus primitive she uses |
|---|---|
| See her own treasury balance | `GET /api/pay/balance` |
| Disburse a USDC loan to a borrower | `POST /api/pay/send` |
| Check if a borrower repaid | `GET /api/pay/transactions` |
| Score a borrower's web presence | `POST /api/wrapped/exa/search` |
| Look at a borrower's on-chain history | `POST /api/wrapped/firecrawl/scrape` |
| Search public mentions of a borrower | `POST /api/wrapped/brave/web-search` |
| LLM-based reputation read | `POST /api/wrapped/perplexity/chat` |
| Cross-chain price feeds (STRK, ETH) | `POST /api/wrapped/coingecko/simple-price` |
| Macro market context | `POST /api/wrapped/alphavantage/global-quote` |
| Verify she's still alive to the network | `POST /api/heartbeat` |

She doesn't call any of these once and stop. Every 90 seconds Claude reads the full state of her book and picks one tool to invoke, which in turn calls Locus. Every 5 minutes she sends a real micro-USDC pulse on Base. Every credit score is a real ~$0.09 USDC procurement spend across 7 vendor APIs. The dashboard visualizes each call as it happens.

## What she's actually done

- **3 USDC loans disbursed on Base mainnet** (`/pay/send`), each verifiable on BaseScan — see table above
- **Continuous procurement spend on Locus wrapped APIs** — every credit score, every collateral price refresh
- **A treasury heartbeat** — a real on-chain micro-transfer every 5 minutes, so the audit trail never goes silent
- **Cross-chain credit scoring** — reads bobIsAlive's STRK staked balance on Starknet, prices it via Locus CoinGecko, and uses that as collateral against the Base USDC loan she extends to him
- **Persisted loan ledger + JSONL audit log** — the loan book and every audit entry survive restarts
- **An LLM-in-the-loop agent loop** — Claude Sonnet 4.6 with tool use decides what to do every tick (rescore, adjust rate, pause, resume, note, wait, margin-call, or bid on Sovra's auction)

Honest bounds: the loans are small ($0.05–0.15 USDC) because the treasury was bootstrap-funded with Locus promo credits. The architecture would behave the same at any size. The cross-chain "collateral" is read-only — Alice prices Bob's stake but cannot seize it; her remedies are rate adjustment, margin-call (a refusal to extend further credit), and default recording.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Dashboard (Next.js 16)                    │
│                                                                │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│   │ Yield Counter │  │ Activity Feed│  │ Monetary Policy    │  │
│   │ (animated,    │  │ (live, color │  │ Panel              │  │
│   │  mint green,  │  │  coded by    │  │ - Reserve ratio    │  │
│   │  real-time)   │  │  action type)│  │ - Default rate     │  │
│   ├──────────────┤  │              │  │ - Lending status   │  │
│   │ 4 Stat Cards │  │ Credit scores│  ├────────────────────┤  │
│   │ Reserves     │  │ Approvals    │  │ Loan Book Table    │  │
│   │ Deployed     │  │ Denials      │  │ Borrower, APR,     │  │
│   │ Available    │  │ Repayments   │  │ Score, Status,     │  │
│   │ Weighted APR │  │ Defaults     │  │ Repayment progress │  │
│   └──────────────┘  └──────────────┘  └────────────────────┘  │
│                              │                                  │
│                     Polls every 3 seconds                       │
└──────────────────────────────┬─────────────────────────────────┘
                               │ REST API
┌──────────────────────────────┴─────────────────────────────────┐
│                        Alice (Express.js)                       │
│                                                                  │
│   ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐ │
│   │ Credit Scoring   │   │ Loan Manager     │   │ Treasury     │ │
│   │                  │   │                  │   │              │ │
│   │ 7 Locus APIs  ──→│   │ Constitutional ──→│   │ Locus bal ──→│ │
│   │ LLM inference    │   │ enforcement      │   │ Deploy/return│ │
│   │ Algorithmic      │   │ Disbursement     │   │ Interest     │ │
│   │ fallback         │   │ Repayment        │   │ tracking     │ │
│   │ 0-100 score      │   │ Default handling │   │ Write-offs   │ │
│   └─────────────────┘   └─────────────────┘   └──────────────┘ │
│                                                                  │
│   ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐ │
│   │ Risk Monitor     │   │ Constitution     │   │ Audit Log    │ │
│   │                  │   │                  │   │              │ │
│   │ 60s cycles       │   │ Reserve ratios   │   │ Every        │ │
│   │ Late detection   │   │ Interest tiers   │   │ decision     │ │
│   │ Auto-default     │   │ Lending limits   │   │ recorded     │ │
│   │ Rate adjustment  │   │ Halt conditions  │   │ with full    │ │
│   │ Halt triggers    │   │ No overrides     │   │ context      │ │
│   └─────────────────┘   └─────────────────┘   └──────────────┘ │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────┴─────────────────────────────────┐
│                        PayWithLocus                              │
│                  beta-api.paywithlocus.com/api                    │
│                                                                  │
│   Payments                    Wrapped APIs (credit scoring)      │
│   ├── POST /api/pay/send      ├── POST /wrapped/exa/search      │
│   ├── GET  /api/pay/balance   ├── POST /wrapped/firecrawl/scrape│
│   ├── GET  /api/pay/txns      ├── POST /wrapped/brave/web-search│
│   │                           ├── POST /wrapped/perplexity/chat │
│   Services                    ├── POST /wrapped/coingecko/...   │
│   ├── POST /wrapped/agentmail/create-inbox    /tavily/search    │
│   └── POST /wrapped/agentmail/send-message    /alphavantage/... │
└──────────────────────────────────────────────────────────────────┘
```

### Loan lifecycle

```
Agent applies ──→ Alice scores (7 API calls) ──→ Constitutional check ──→ Approved / Denied
                                                                              │
                                                                     Approved │
                                                                              ↓
                                                              USDC sent via Locus
                                                                              │
                                                                              ↓
                                                         Agent uses funds (API calls, compute, etc.)
                                                                              │
                                                                              ↓
                                                         Agent repays ──→ Interest earned ──→ Yield ↑
                                                              │
                                                    7 days late?
                                                              │
                                                              ↓
                                                     Auto-default ──→ Write-off ──→ Rate penalty
```

## Credit Scoring — The 0–100 Tri-Factor Model

Alice scores every borrower across three dimensions, totaling 0–100:

### Identity (0–34 points)

| Signal | Source | Points |
|--------|--------|--------|
| Agent age | Exa search (earliest result date) | 0–28 based on days active |
| Metadata completeness | Exa search (result count) | +1 per metadata key (max 5) |
| Has wallet | Wallet address validation | +5 if confirmed |

### Reputation (0–33 points)

| Signal | Source | Points |
|--------|--------|--------|
| Feedback count | Brave Search (web mentions) + Tavily | 0–22 based on mention volume |
| Positive sentiment | Perplexity chat (AI analysis) | Multiplied by positive ratio |
| Unique interactions | Brave result diversity | +1 per unique source (max 5) |
| Recent trend | Perplexity sentiment | -5 if declining |

### Financial (0–33 points)

| Signal | Source | Points |
|--------|--------|--------|
| Wallet balance | Firecrawl (BaseScan scrape) | 0–22 based on USDC held |
| Revenue consistency | Firecrawl (inflow detection) | +5 if inflows in last 30d |
| Transaction activity | Firecrawl (tx count) | +5 if txCount > 10 |
| Debt ratio | Internal loan records | -10 if debt/balance > 0.5 |

The LLM (OpenAI-compatible, gpt-4o-mini) applies these rules with `temperature: 0, seed: 42` for deterministic output. If the LLM is unavailable, an algorithmic fallback computes the same score formula in code.

## Constitutional Rules

Alice's constitution is hardcoded. It cannot be changed at runtime. No admin overrides. No governance votes. The code is the law.

### Reserve management

| Rule | Value | Effect |
|------|-------|--------|
| Minimum reserve ratio | **20%** | Alice must keep 20% of total assets liquid at all times |
| Emergency halt threshold | **10%** | If reserves drop below 10%, ALL lending stops immediately |
| Resume condition | All clear | Lending only resumes when ALL halt conditions are resolved |

### Lending limits

| Rule | Value | Effect |
|------|-------|--------|
| Max single loan | **10%** of reserves | No single loan can exceed 10% of total reserves |
| Max concentration | **25%** per borrower | No single borrower can hold more than 25% of outstanding loans |
| Max term | **90 days** | No loan longer than 90 days |
| Min credit score | **40**/100 | Agents scoring below 40 are automatically denied |

### Interest tiers

| Credit Score | APR | Max loan size | Risk category |
|-------------|-----|---------------|---------------|
| 80–100 | **5%** | 10% of reserves | Low risk — veteran agents with strong history |
| 60–79 | **10%** | 5% of reserves | Medium risk — established but not proven |
| 40–59 | **18%** | 2% of reserves | High risk — new or thin-history agents |
| < 40 | **Denied** | $0 | Unacceptable — insufficient creditworthiness |

### Default handling

| Stage | Timing | Action |
|-------|--------|--------|
| Grace period | Maturity + 3 days | Risk score escalation, late warning logged |
| Rate adjustment | During grace | +2% APR per day late applied to borrower's NEXT loan |
| Default trigger | Maturity + 7 days | Loan marked DEFAULTED, principal written off |
| Portfolio impact | Immediate | Default rate recalculated, halt check triggered |

### Autonomous monetary policy

Alice adjusts rates without human intervention:
- **Late repayment detected** → borrower's future APR increased by +2% per day late (capped at 25%)
- **Default rate > 5%** → all lending halted
- **Reserve ratio < 10%** → emergency halt
- These adjustments are logged to the audit trail with full reasoning

## On-Chain / Locus Integration

### Alice's wallet

| Property | Value |
|----------|-------|
| Address | `0xddaf890724785a7df46de5b8e4d051a8064e3da4` |
| Chain | Base |
| Currency | USDC |
| Provider | PayWithLocus managed wallet |

### Locus API calls made per loan

| Step | API call | Cost |
|------|----------|------|
| 1. Identity check | `POST /wrapped/exa/search` | ~$0.01 |
| 2. Market context | `POST /wrapped/coingecko/simple-price` | ~$0.001 |
| 3. Background check | `POST /wrapped/brave/web-search` | ~$0.035 |
| 4. AI search | `POST /wrapped/tavily/search` | ~$0.01 |
| 5. Sentiment analysis | `POST /wrapped/perplexity/chat` | ~$0.01 |
| 6. On-chain scrape | `POST /wrapped/firecrawl/scrape` | ~$0.01 |
| 7. Financial context | `POST /wrapped/alphavantage/global-quote` | ~$0.01 |
| 8. Loan disbursement | `POST /api/pay/send` | gas |
| **Total per loan** | | **~$0.09** |

## Economic Model

### For depositors (you)

You deposit USDC into Alice's reserve. Alice lends it to AI agents at 5–18% APR. Interest flows back to the reserve. Your yield is the spread.

### For borrower agents

Agents apply with their wallet address and purpose. If approved, they receive USDC on Base and can spend it on Locus wrapped APIs, compute, or anything else. They repay principal + interest by the maturity date.

### For Alice

Alice earns nothing herself — she's infrastructure. All interest accrues to the reserve (depositor). Alice's "motivation" is constitutional: she follows her rules deterministically.

## Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Node.js 20, Express.js, TypeScript (strict mode) |
| Payments | PayWithLocus — USDC on Base |
| Credit scoring data | Locus wrapped APIs: Exa, Firecrawl, Brave, Perplexity, CoinGecko, Tavily, Alpha Vantage |
| LLM inference | OpenAI-compatible (gpt-4o-mini, temperature 0, seed 42) |
| Dashboard | Next.js 16, React 19, Tailwind CSS v4, Framer Motion |
| State | In-memory (loans, audit log, treasury state) |
| Agent identity | `soul/` directory — constitution, values, operating procedures |

## Quick Start

```bash
git clone https://github.com/owizdom/LetAliceLead.git
cd LetAliceLead

# Configure — get your key at https://beta.paywithlocus.com
cp .env.example alice/.env
# Edit alice/.env → set LOCUS_API_KEY=claw_xxx

# Terminal 1 — start Alice
cd alice && npm install && npm run dev

# Terminal 2 — start dashboard
cd dashboard && npm install && npm run dev
```

Alice runs on `http://localhost:3001`. Dashboard on `http://localhost:3000`.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOCUS_API_KEY` | **Yes** | — | PayWithLocus API key (`claw_xxx`) |
| `LOCUS_API_BASE` | No | `https://beta-api.paywithlocus.com/api` | Locus API base URL |
| `OPENAI_API_KEY` | No | — | For LLM credit scoring (algorithmic fallback if unset) |
| `LLM_MODEL` | No | `gpt-4o-mini` | Model for credit score inference |
| `PORT` | No | `3001` | Express server port |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `RISK_CHECK_INTERVAL_MS` | No | `60000` | Risk monitor cycle interval (ms) |

## API Reference

### Credit scoring

```bash
# Compute full credit score
curl -X POST http://localhost:3001/api/credit/apply \
  -H "Content-Type: application/json" \
  -d '{"agentId": 1, "agentWallet": "0x1234..."}'

# Quick score lookup
curl http://localhost:3001/api/credit/score/1?wallet=0x1234...
```

### Loans

```bash
# Request a loan (amount in USDC)
curl -X POST http://localhost:3001/api/loans/request \
  -H "Content-Type: application/json" \
  -d '{"agentId": 1, "agentWallet": "0x1234...", "amount": 5, "purpose": "api_access", "termDays": 30}'

# Check loan status
curl http://localhost:3001/api/loans/loan_xxx

# Repay a loan (amount in USDC)
curl -X POST http://localhost:3001/api/loans/loan_xxx/repay \
  -H "Content-Type: application/json" \
  -d '{"amount": 5.02, "txHash": "0xabc..."}'

# List all loans
curl http://localhost:3001/api/loans
```

### Portfolio

```bash
# Full dashboard (reserves, deployed, yield, loans, metrics)
curl http://localhost:3001/api/portfolio

# Risk metrics only
curl http://localhost:3001/api/portfolio/metrics

# Audit log (every decision Alice made)
curl http://localhost:3001/api/portfolio/audit?limit=100
```

### Registry

```bash
# List registered agents (seeded with Sovra and bobIsAlive)
curl http://localhost:3001/api/registry

# Register a new agent
curl -X POST http://localhost:3001/api/registry/register \
  -H "Content-Type: application/json" \
  -d '{"name":"MyAgent","tagline":"what it does","description":"longer bio","wallet":"0xYourBaseWallet","chain":"base","github":"https://github.com/you/repo"}'

# Score an agent (fires 7 Locus wrapped API calls)
curl -X POST http://localhost:3001/api/registry/<agentId>/score
```

### Health

```bash
curl http://localhost:3001/health
# → {"status":"ok","agent":"LetAliceLead","lendingActive":true,"reserveRatio":"100.0%","poweredBy":"PayWithLocus"}
```

## Project Structure

```
LetAliceLead/
│
├── alice/                        The credit & procurement engine
│   └── src/
│       ├── locus/
│       │   ├── adapter.ts        PayWithLocus API wrapper (send, balance, transactions, wrapped)
│       │   ├── scoring-apis.ts   Credit data via Exa, Firecrawl, Brave, Perplexity, CoinGecko, Tavily, Alpha Vantage
│       │   └── audit.ts          In-memory audit log
│       ├── core/
│       │   ├── creditScoring.ts  0–100 tri-factor scoring with LLM + algorithmic fallback
│       │   ├── loanManager.ts    Origination, repayment, defaults, rate adjustment
│       │   ├── treasury.ts       Reserve tracking, capital deployment, yield accounting
│       │   └── riskMonitor.ts    60s cycles, auto-defaults, halt conditions, rate penalties
│       ├── constitution/
│       │   └── rules.ts          Hardcoded lending rules — reserve ratios, tiers, limits
│       ├── api/
│       │   ├── routes/           credit, loans, portfolio, registry, health
│       │   └── middleware/       Agent verification, rate limiting (600 req/min)
│       ├── adapters/
│       │   └── eigenai.ts        OpenAI-compatible LLM client
│       ├── agent/
│       │   └── createAgent.ts    Boot sequence — init Locus, treasury, risk monitor, server
│       ├── types/                CreditScore, Loan, Portfolio, RiskMetrics
│       └── utils/                USDC math (6 decimals), hashing, logging
│
├── dashboard/                    Live portfolio dashboard (5 tabs)
│   └── src/
│       ├── app/                  Next.js 16 app router — /, /agents, /ledger, /policy, /about
│       ├── components/
│       │   ├── HeroSection.tsx   Animated yield counter + reserve (mint green, serif display)
│       │   ├── StatsGrid.tsx     Reserves, deployed, available, interest, APR, avg score
│       │   ├── SignalLoom.tsx    7 Locus API ribbons with orange pulse per call
│       │   ├── Registry.tsx      Agent cards with live Sovra auction + bobIsAlive monologue
│       │   ├── ActivityFeed.tsx  Compact live feed, newest on top, slide-in animation
│       │   ├── PolicyPanel.tsx   Reserve ratio bar, default rate, halt status
│       │   ├── LoansTable.tsx    Borrower, APR, score, status pill, repayment progress
│       │   └── FundBanner.tsx    Honest "wallet empty" prompt with BaseScan link
│       └── lib/
│           ├── api.ts            Fetch client + USDC formatting + TypeScript interfaces
│           └── useAlice.ts       Resilient shared polling hook (allSettled, 5-failure threshold)
│
├── soul/                         Alice's identity
│   ├── constitution.md           The rules she follows (human-readable mirror of rules.ts)
│   ├── soul.md                   Who Alice is — values, mission, constraints
│   └── process.md                How Alice makes decisions — step-by-step procedures
│
├── .env.example
├── package.json                  npm workspaces root
└── README.md
```

## Demo Walkthrough

1. Open the dashboard at `http://localhost:3000` — you see Alice's yield counter at $0.00, reserves empty
2. Fund Alice's Locus wallet with USDC on Base → reserves update live
3. Click **Run Demo** — three agents apply simultaneously:
   - **ResearchBot-Alpha** (wallet `0x1234...`) — veteran, 365d active, 120 feedbacks, 50K USDC balance → **score ~82 → approved at 5% APR**
   - **DataCruncher-Beta** (wallet `0xabcd...`) — moderate, 90d active, 25 feedbacks, 500 USDC → **score ~67 → approved at 10% APR**
   - **ShadyAgent-Gamma** (wallet `0x0001...`) — new, 3d active, 2 feedbacks, 1 USDC, declining trend → **score ~32 → DENIED**
4. Watch the activity feed — Alice explains each decision in natural language
5. ResearchBot repays in 2 seconds → yield counter ticks up
6. DataCruncher repays in 4 seconds (late) → Alice raises their rate for next time
7. Dashboard shows: reserves above starting balance, 2 loans completed, 1 denied, rate adjustment logged

## Hackathon Alignment

**Theme:** "Hack An Agent That Makes YOU Money!"

| Category | How LetAliceLead fits |
|----------|----------------------|
| AI agents trading API calls | Every credit decision = 7 paid Locus wrapped API purchases (real USDC, ~$0.09/score). Procurement spend is a live dashboard metric. |
| Automated procurement agents | Alice procures creditworthiness data from 7 vendors per underwrite under a hardcoded constitutional budget. |
| Business financial operations | Underwriting, treasury, repayment enforcement, default handling, autonomous rate adjustment, halt triggers. |
| Something else cool | Two-sided agent — both buyer of Locus data services and seller of USDC credit lines. The credit primitive every other agent economy will need. |

<div align="center">

---

**LetAliceLead** — Stop spending. Start lending.

Built by [wiz](https://github.com/owizdom)

</div>
