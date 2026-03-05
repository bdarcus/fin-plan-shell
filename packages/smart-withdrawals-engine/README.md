# @fin-plan/smart-withdrawals-engine

A headless Monte Carlo simulation and actuarial life expectancy engine.

## Usage

### Monte Carlo Simulation

Simulate 1,000 market scenarios to find a safe "floor" for your withdrawal strategy.

```typescript
import { runMonteCarlo } from "@fin-plan/smart-withdrawals-engine/monte-carlo";

const result = runMonteCarlo({
	startBalance: 1000000,
	equityAllocation: 0.6, // 60% stocks
	years: 30,
	equityReturn: 0.05, // 5% real
	equityVol: 0.15, // 15% standard deviation
	tipsReturn: 0.02, // 2% real safe return
	incomeStreams: [], // Any guaranteed income (Social Security, Pensions)
	spendingFloor: 40000, // Desired minimum real spending floor
	seed: 42, // Optional reproducible random seed
});

console.log(result.p50); // Median outcome array over 30 years
console.log(result.floorBreachPathRate); // % of sims that breached spending floor at least once
```

### Actuarial Life Expectancy

Calculate a dynamic planning horizon based on Gompertz-Makeham mortality models.

```typescript
import {
	calculateTargetHorizon,
	getTargetProbFromMargin,
} from "@fin-plan/smart-withdrawals-engine/life-expectancy";

const horizon = calculateTargetHorizon(
	[{ age: 65, gender: "male" }],
	0.1, // Target probability of outliving the money (e.g. 10%)
);
```

This library contains zero dependencies and works in any JavaScript/TypeScript runtime.
