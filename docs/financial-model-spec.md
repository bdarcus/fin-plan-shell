# Financial Model Spec (Clean Room)

## Scope

- Defines public, implementation-independent financial logic for:
  - `tips-engine`
  - `portfolio-engine`
  - `smart-withdrawals-engine`
  - `pension-engine`
  - `social-security-engine`
- All formulas and conventions are derived from public finance mathematics and fixed-income practice.

## Clean-Room Constraints

- Do not copy source code or proprietary implementation details from unlicensed repositories.
- Validate against public domain equations, independent calculations, and reproducible tests.

## Units and Timing

- Dollar outputs are real dollars unless explicitly marked nominal.
- TIPS ladder calculations are date-aware and use settlement-date timing.
- Bond quantity unit is per `$100` par.

## Core Invariants

- No negative trade quantities.
- No silent liability gaps:
  - residual liabilities must be surfaced as `unmetIncome`.
  - optional strict mode must throw on unmet liabilities.
- Deterministic tests for stochastic models require a fixed seed.

## TIPS Ladder Rules

- Primary objective: cover year-by-year real spending liabilities over `[startYear, endYear]`.
- Use exact maturity-year bond when available and efficient.
- Gaps:
  - use nearest lower and upper maturities for duration interpolation.
  - clamp duration weights to `[0, 1]`.
  - do not select out-of-horizon maturities unless explicitly enabled.
- Maturity cashflow includes principal floor at par (`$100`) in real-dollar planning terms.

## Monte Carlo Withdrawal Rules

- Withdrawals follow variable amortization each year using expected real return and remaining horizon.
- Risk metrics are floor-based, not SWR-style:
  - path breach rate
  - year-by-year breach rate
  - conditional shortfall severity
  - persistent-breach run length

## Public References

- U.S. Treasury TIPS basics and indexation mechanics.
- Standard annuity/amortization mathematics.
- Gompertz-Makeham mortality model (actuarial approximation).
