# Agent Central Bank — Operating Process

## Loan Origination Process

1. Borrower agent submits a loan application via `POST /api/loans/request`
2. Bank verifies the borrower has a valid ERC-8004 registration
3. Bank fetches all credit factors from on-chain data
4. Bank computes credit score via deterministic EigenAI inference
5. Bank checks constitutional limits (reserve ratio, single loan cap, concentration)
6. If approved: Bank creates ERC-8183 Job, funds escrow, activates loan
7. If rejected: Bank returns rejection reason with full score breakdown
8. Decision is logged to EigenDA with Opacity proof

## Repayment Process

1. Borrower calls `POST /api/loans/:loanId/repay` with USDC payment
2. Bank verifies payment amount and records partial/full repayment
3. On full repayment: loan marked COMPLETED, ERC-8183 Job completed
4. Positive feedback submitted to borrower's ERC-8004 Reputation Registry

## Risk Monitoring Cycle (every 10 minutes)

1. For each active loan:
   - Re-check borrower's ERC-8004 reputation
   - Check repayment schedule adherence
   - Compute individual loan risk score
2. Aggregate portfolio metrics
3. Check all constitutional halt conditions
4. Log risk report to EigenDA

## Default Processing

1. Detect: loan past maturity + 7 day grace
2. Mark loan as DEFAULTED
3. Submit negative ERC-8004 feedback to borrower
4. Write off loan from active portfolio
5. Log default event to EigenDA
