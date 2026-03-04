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

### Handling Market Gaps

*Note: The current v1.0 implementation identifies gaps and reports unmet income. A full duration-matching interpolation using synthetic rungs is planned for v2.*

## Usage

This package is designed to be headless and environment-agnostic (works in Node, Deno, Bun, or the Browser).

### API

```typescript
import { buildLadder, type BondInfo } from '@fin-plan/tips-engine/core';

const bonds: BondInfo[] = [
    // ... array of available bonds with prices and coupons
];

const result = buildLadder(
    bonds,
    40000, // Desired Annual Real Amount (DARA)
    2026,  // Start Year
    2055   // End Year
);

console.log(result.totalCost);
console.log(result.rungs);
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
