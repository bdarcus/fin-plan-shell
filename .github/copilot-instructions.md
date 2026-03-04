# GitHub Copilot Instructions for Financial Planning Shell

These instructions guide GitHub Copilot in providing reviews and generating code consistent with the architectural principles of this project.

## Core Technology Stack
- **Svelte 5:** Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$derived.by`).
  - **NEVER** use Svelte 4 syntax like `export let` for props.
  - **NEVER** use `$: reactive statements`.
- **Bun:** Primary package manager and runtime.
- **Tailwind 4:** Use modern CSS-first Tailwind 4 patterns.

## Domain Specific Rules (Financial)
- **Currency Precision:** When performing calculations for `annualBenefit`, `amortizationIncome`, or `portfolio balance`, ensure no floating point errors occur. Default to standard math for prototypes but flag complex rounding needs.
- **Real vs. Nominal:** Always assume values are in **Real Dollars** (inflation-adjusted) unless explicitly stated otherwise.
- **TIPS Module:** Any changes to the rebalancing engine MUST cite the original attribution: `https://github.com/aerokam/TipsLadderBuilder`.

## Architectural Rules
- **Modular Registry:** New financial strategies must implement the `FinancialModule` interface located in `src/lib/core/types.ts`.
- **Income Streams:** Income modules must provide a `getIncomeStreams` function matching the `FinancialModule` interface, i.e. `engine.getIncomeStreams?: (state) => IncomeStream[]`, where each `IncomeStream` contains `annualAmounts: Record<number, number>` mapping years to real amounts.
- **GitHub Pages:** This project is deployed to a subfolder (`/fin-plan-shell`). All `goto` calls and internal links MUST use the `base` path from `$app/paths`.

## Review Priorities
1. **Svelte 5 Rune Correctness:** Ensure runes are not used inside nested functions unless wrapped in a closure or passed as proxies.
2. **Path Handling:** Flag any absolute paths (e.g., `/design`) and suggest using `${base}/design`.
3. **Module Isolation:** Ensure modules do not directly mutate each other's stores. Use `registry.getModule('id').store.publicData` for cross-module communication.
