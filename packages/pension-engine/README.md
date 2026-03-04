# @fin-plan/pension-engine

A headless financial engine for projecting defined benefit pension streams.

## Usage

```typescript
import { calculatePensionStream } from '@fin-plan/pension-engine/core';

const stream = calculatePensionStream({
    annualBenefit: 20000,
    startYear: 2030,
    hasCOLA: false // No cost of living adjustment
}, 2026, 40);

console.log(stream.annualAmounts);
```

This library contains zero dependencies and works in any JavaScript/TypeScript runtime.
