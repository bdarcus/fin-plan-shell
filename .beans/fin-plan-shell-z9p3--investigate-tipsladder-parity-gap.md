---
# fin-plan-shell-z9p3
title: Investigate TIPS ladder parity gap vs tipsladder.com
status: todo
type: task
priority: high
tags:
  - engine
  - tips
  - parity
created_at: 2026-03-05T12:25:00Z
updated_at: 2026-03-05T12:25:00Z
---

## Findings (2032-2046, DARA $60k)
- tipsladder.com reference estimate: $817,513
- current fin-plan-shell (Cheapest strategy):
  - adjusted-principal estimate: $773,561.01
  - clean-price approximation: $695,311.69
  - unmet years: none
- parity gap vs tipsladder (adjusted): -$43,951.99 (our estimate is lower)

## What changed in this round
- enabled synthetic substitution even when an exact maturity exists (Cheapest mode), when blended synthetic cost/coverage is cheaper than exact bond cost/coverage
- added pair search across lower/upper candidates for cheapest synthetic selection
- kept unmet-income guardrails and synthetic gap-year funding logic intact

## Remaining parity unknowns
- cost-basis convention mismatch (quoted clean vs adjusted principal vs invoice/accrued treatment)
- synthetic liquidation/funding convention mismatch for gap years
- potential differences in coupon timing or carry assumptions by year
- potential constraints tipsladder enforces that we currently do not (e.g., maturity preference, issue constraints, optimization bounds)

## Next steps
1. Add a strict "tipsladder-compat" mode that matches their published conventions explicitly (cost basis + gap-year treatment + constraints).
2. Build a scenario-level parity test harness with fixed market snapshot and expected range around tipsladder output.
3. Replace heuristic+trim optimizer with a globally constrained solver for minimum-cost full-liability coverage under compat assumptions.
