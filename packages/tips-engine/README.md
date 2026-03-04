# @fin-plan/tips-engine

A headless, clean-room implementation of a TIPS (Treasury Inflation-Protected Securities) bond ladder generator.

This package implements the **Desired Annual Real Amount (DARA)** method (sometimes called the "Pfau Method" in retirement planning circles) to construct an immunized bond ladder that provides a guaranteed real income stream over a specified horizon.

## Clean Room Implementation

This engine was developed entirely independently from any proprietary or unlicensed codebases. It relies purely on public financial mathematics and standard LDI (Liability-Driven Investment) strategies.

### The Algorithm ("Working Backward")

The core problem with a bond ladder is that longer-dated bonds pay semi-annual coupons that "drip" income into the years *before* they mature. If you buy enough bonds to cover Year 10, the coupons from those bonds will partially cover your income needs in Years 1 through 9.

To solve this efficiently without circular dependencies, the algorithm iterates in **reverse chronological order**:
1. **Initialize:** A map to track cumulative "coupon drips" for each year.
2. **Iterate:** Starting from the `endYear` down to the `startYear`:
   - Calculate the net cash needed: `Need = DARA - CouponDrip[Year]`
   - Find the best available TIPS bond maturing in that year.
   - Calculate how much Par Value is required to fulfill the `Need`, factoring in that the bond pays principal + one half-year coupon at maturity.
   - Calculate the cost based on the bond's clean price.
   - Add all of this bond's future annual coupons to the `CouponDrip` map for all years *prior* to maturity.

### Handling Market Gaps (Pre-Funding Strategy)

This engine handles Treasury maturity gaps using a **Safety-First Pre-funding** strategy. When a specific year lacks a maturing bond, the LDI solver automatically purchases additional quantities of the **nearest available prior maturity**. 

This ensures that the principal is physically available in the account *before* the spending need arises, guaranteeing 100% cashflow coverage regardless of Treasury auction gaps. The engine tracks this carried-forward cash to prevent over-funding later years.

### Portfolio Maintenance (Rebalancing)

A unique feature of this engine is the **Rebalance Solver**. Bond ladders are not static; the US Treasury regularly auctions new TIPS that may fill previous maturity gaps (e.g., the 5-year and 10-year TIPS cycles).

- **Gap Discovery:** When new bond data is ingested (via WSJ or TreasuryDirect), the engine automatically detects if a previously "pre-funded" gap can now be satisfied by a more efficient, direct maturity.
- **Actionable Trades:** The `calculateRebalance` function compares your `currentHoldings` against the ideal `targetLadder` and generates specific `BUY`, `SELL`, or `HOLD` trade tickets.
- **Dynamic Optimization:** If you previously bought extra 2026 bonds to cover a 2027 gap, and a new 2027 bond is issued, the engine will recommend selling the excess 2026s and buying the 2027s to lock in the ladder's duration more precisely.

## Usage

### 1. Generating a New Ladder
```typescript
import { buildLadder, type BondInfo } from '@fin-plan/tips-engine';

const result = buildLadder(bonds, 40000, 2026, 2055);
console.log(result.rungs);
```

### 2. Maintenance / Rebalancing
```typescript
import { calculateRebalance } from '@fin-plan/tips-engine';

const rebalance = calculateRebalance(
    latestMarketBonds, 
    userPortfolioHoldings, 
    40000, // target income
    2026, 2055
);

// This returns a list of trades:
console.log(rebalance.trades); 
// Output: [{ cusip: "...", action: "BUY", qty: 50 }, { cusip: "...", action: "SELL", qty: 20 }]
```

### CLI

A built-in CLI allows you to generate human-readable reports using real bond data.

```bash
# In the package directory:
bun run src/cli.ts --dara 40000 --start 2026 --end 2035
```

## Data Integration

To ensure maximum portability, this engine expects a standardized `BondInfo` interface. It does not dictate *where* you get your data. You can fetch TIPS quotes from the WSJ, TreasuryDirect, or a Bloomberg terminal, map it to `BondInfo`, and pass it to `buildLadder`.

Included in the source is `src/fetch-wsj.ts`, a reference script demonstrating how one might parse TIPS quotes from public web sources like the Wall Street Journal.
