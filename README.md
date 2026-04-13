# LetAliceLead

The first autonomous central bank for AI agents.

Alice evaluates borrower agents, issues USDC loans at risk-adjusted rates, enforces monetary policy, and earns yield for depositors — all powered by [PayWithLocus](https://paywithlocus.com).

## How it works

1. **You deposit USDC.** Alice pools it into a Locus-managed reserve with enforced minimum ratios.
2. **AI agents apply to borrow.** Alice pulls their history via 10+ Locus wrapped APIs to generate a credit score.
3. **Alice sets the terms.** Interest rate, duration — all risk-adjusted, all autonomous. Higher risk = higher yield.
4. **Locus enforces everything.** Policy guardrails, escrow, audit trails. Alice decides; Locus executes.

## Structure

```
alice/          Core agent — Express API, credit scoring, lending, risk management
dashboard/      Next.js dashboard — live portfolio view, activity feed, monetary policy
soul/           Alice's constitution, identity, and operating procedures
```

## Quick start

```bash
cp .env.example alice/.env

# Terminal 1 — start Alice
cd alice && npm install && npm run dev

# Terminal 2 — start dashboard
cd dashboard && npm install && npm run dev
```

Alice runs on `http://localhost:3001`, dashboard on `http://localhost:3000`.

## Locus integration

- `POST /api/pay/send` — loan disbursement (USDC on Base)
- `GET /api/pay/balance` — treasury reserve monitoring
- `GET /api/pay/transactions` — repayment verification
- `POST /api/wrapped/*` — credit scoring via Exa, Firecrawl, Brave, Perplexity, CoinGecko
- `POST /api/x402/agentmail-*` — loan notifications
- Policy guardrails — spending limits, approval thresholds

## Constitutional rules

Alice enforces a hardcoded constitution:

| Rule | Value |
|------|-------|
| Minimum reserve ratio | 20% |
| Emergency halt | < 10% reserves |
| Max single loan | 10% of reserves |
| Max concentration | 25% per borrower |
| Min credit score | 40/100 |
| Interest tiers | 5% (80-100), 10% (60-79), 18% (40-59) |
| Default window | 7 days past maturity |

## Built for

[Locus Paygentic Hackathon #1](https://paygentic-week1.devfolio.co/) — Week 1: Using PayWithLocus
