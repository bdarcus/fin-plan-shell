# @fin-plan/tips-engine

A headless TypeScript engine for building and maintaining TIPS (Treasury Inflation-Protected Securities) bond ladders.

This package implements a DARA-style ("Desired Annual Real Amount") ladder builder and rebalance solver for retirement-income planning. It is designed to construct an inflation-protected income floor over a target horizon and to keep that ladder aligned as Treasury inventory and portfolio holdings change over time.

## Provenance and Attribution

`@fin-plan/tips-engine` is an original package, but selectively adapts ideas and analysis found in [aerokam/TipsLadderBuilder](https://github.com/aerokam/TipsLadderBuilder), which is MIT-licensed.

That influence is most relevant in the gap-handling and pre-ladder income analysis added during the March 12, 2026 refactor. The package remains a headless engine with its own API surface, tests, and integration layer for this project.

## What It Does

- Builds TIPS ladders that target a real annual spending amount across a year range.
- Handles missing Treasury maturities with synthetic gap coverage instead of assuming every year has a direct rung.
- Rebalances existing holdings into a target ladder and emits actionable `BUY`, `SELL`, and `HOLD` trades.
- Prefers existing holdings when configured, helping maintenance workflows avoid unnecessary churn.
- Filters out maintenance noise with minimum trade quantity and cost thresholds.

## Core Model

### Reverse-Chronological Liability Matching

The ladder builder works backward from the last target year to the first. For each year, it subtracts already-accounted-for coupon income and solves for the remaining real cash need using the best available maturity or synthetic gap coverage.

This reverse pass is what makes the DARA/Pfau-style approach practical: longer-dated bonds contribute coupon income to earlier years, so later allocations affect earlier liabilities.

### Gap-Year Handling

Treasury maturities do not exist for every calendar year. When the market has a gap, the engine can:

- use the nearest lower/upper maturities (`gapUpperSelectionStrategy: "nearest"`), or
- search for a cheaper upper-leg pairing while staying within the engine's guardrails (`"cheapest"`).

For true gap years, the engine uses duration-matched synthetic coverage rather than simply pre-funding the shortfall with a single nearby bond. The current implementation also includes Aerokam-inspired synthetic coupon and pre-ladder interest logic that improves treatment of future-dated ladders.

## Rebalancing and Maintenance

`calculateRebalance` compares current holdings with the target ladder and returns a trade plan plus normalized target positions.

Important current behaviors:

- Trade intents are labeled as `exact-match`, `gap-bridge`, or `maintenance`.
- Sticky rebalance behavior can favor bonds you already hold via `holdingPreferenceWeight`.
- Small maintenance trades can be suppressed with `minTradeQtyThreshold` and `minTradeCostThreshold`.
- Upgrade groups identify cases where existing gap bridges can be replaced by cleaner exact matches as the market evolves.

This is especially useful when new TIPS auctions fill maturity gaps that previously required synthetic coverage.

## Usage

### Build a Ladder

```typescript
import { buildLadder, type BondInfo } from "@fin-plan/tips-engine";

const bonds: BondInfo[] = [
	{
		cusip: "91282CJX0",
		maturity: "2030-01-15",
		coupon: 0.0125,
		price: 98.4,
		baseCpi: 251.712,
		indexRatio: 1.08,
		yield: 0.019,
	},
];

const ladder = buildLadder(bonds, 40000, 2026, 2035, {
	gapUpperSelectionStrategy: "nearest",
	usePreLadderInterest: true,
});

console.log(ladder.rungs);
console.log(ladder.positions);
```

### Rebalance Existing Holdings

```typescript
import {
	calculateRebalance,
	type BondInfo,
	type Holding,
} from "@fin-plan/tips-engine";

const bonds: BondInfo[] = [];
const holdings: Holding[] = [{ cusip: "91282CJX0", qty: 25 }];

const rebalance = calculateRebalance(bonds, holdings, 40000, 2026, 2035, {
	gapUpperSelectionStrategy: "cheapest",
	currentHoldings: holdings,
	holdingPreferenceWeight: 0.9,
	minTradeQtyThreshold: 1,
	minTradeCostThreshold: 100,
});

console.log(rebalance.trades);
console.log(rebalance.upgradeGroups);
```

## CLI

The package includes a small CLI for generating a ladder report from local bond data:

```bash
bun run src/cli.ts --dara 40000 --start 2026 --end 2035
```

## Data Model

The engine expects normalized market data through the `BondInfo` interface. It does not require a specific data provider; callers can source TIPS quotes from TreasuryDirect, WSJ-derived feeds, or proprietary systems and map them into the package types.

This package also exports adapter and market-data helpers used by the surrounding application, but the core ladder builder and rebalance solver are intentionally usable on their own.
