# @fin-plan/portfolio-engine

A headless, zero-dependency financial engine for projecting portfolio growth and calculating constant real amortization.

## Usage

```typescript
import { calculateConstantAmortization, projectPortfolio } from '@fin-plan/portfolio-engine/core';

// Calculate how much you can spend per year (in real dollars)
const spending = calculateConstantAmortization(
    1000000, // Portfolio Balance
    0.04,    // Expected Real Return (4%)
    30       // Horizon (Years)
);

// Project the portfolio balance over time based on that spending
const projection = projectPortfolio(
    1000000, // Initial Balance
    0.04,    // Real Return
    30,      // Horizon
    spending // Annual Spending
);
```

This library is designed to be mathematically pure and platform-agnostic, suitable for use in Svelte, React, Node CLIs, or serverless functions.
