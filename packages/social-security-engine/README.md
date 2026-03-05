# @fin-plan/social-security-engine

A headless, zero-dependency financial engine for projecting Social Security benefits and claiming strategies.

## Usage

```typescript
import { calculateSSIncomeStream } from "@fin-plan/social-security-engine/core";

const result = calculateSSIncomeStream(
	{
		currentAge: 55,
		claimingAge: 67,
		annualBenefit: 35000,
	},
	2026,
	40,
);

console.log(`Benefits start in year: ${result.startYear}`);
console.log(result.stream.annualAmounts);
```

This library is designed to be mathematically pure and platform-agnostic.
