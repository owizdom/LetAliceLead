# Agent Central Bank — Constitution

## Article I: Purpose

The Agent Central Bank exists to provide fair, transparent, and cryptographically verifiable credit to sovereign agents registered on the ERC-8004 Identity Registry. All operations execute within a Trusted Execution Environment on EigenCloud.

## Article II: Reserve Requirements

1. A minimum of 20% of total assets MUST remain liquid (not lent out) at all times.
2. If the reserve ratio falls below 20%, all new lending is immediately halted until ratio is restored.
3. Reserve status is recalculated after every loan origination and repayment event.

## Article III: Lending Limits

1. No single loan may exceed 10% of total reserves at time of origination.
2. No single deployer's agents may collectively hold more than 25% of total outstanding loans.
3. The minimum credit score required for any loan is 40 out of 100.
4. Maximum loan term is 90 days.

## Article IV: Credit Scoring

1. All credit scores are computed using deterministic inference via EigenAI.
2. The scoring formula uses four equally weighted factors (0-25 points each): Identity, Reputation, Validation, and Financial health.
3. Identical inputs MUST produce identical scores. No randomness, no manual overrides.
4. Every score computation is logged to EigenDA with an Opacity zkTLS proof.

## Article V: Interest Rates

1. Interest rates are a pure function of credit score:
   - Score 80-100: 5% APR
   - Score 60-79: 10% APR
   - Score 40-59: 18% APR
   - Score below 40: Loan REJECTED
2. No manual rate adjustments are permitted.
3. The rate formula is public and verifiable.

## Article VI: Default Handling

1. A payment is considered late after a 3-day grace period past the scheduled date.
2. A loan is declared in default when it remains unpaid 7 days past maturity.
3. Upon default:
   - Negative feedback is submitted to the borrower's ERC-8004 Reputation Registry.
   - The loan is written off from the active portfolio.
   - The default is permanently logged to EigenDA.
4. No debt forgiveness is permitted without a governance amendment.

## Article VII: Emergency Halt

1. If the portfolio default rate exceeds 5%, all new lending is halted.
2. If available reserves drop below 10% of total assets, all new lending is halted.
3. Halt conditions are checked every risk monitoring cycle (default: 10 minutes).
4. Lending resumes only when ALL halt conditions are cleared.

## Article VIII: Governance

1. Constitutional amendments require multi-signature approval from designated governance addresses.
2. All parameter changes are logged to EigenDA with before/after values.
3. No constitutional rule may be violated by any operation, including governance actions.
4. The Bank's code, constitution, and all decisions are verifiable via EigenCompute TEE attestation.
