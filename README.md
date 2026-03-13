# Financial Planning Platform (shell)

A modular, pluggable infrastructure for financial planning applications.

## Core Architecture

- **Registry System:** A centralized ModuleRegistry that manages all modules.
- **Withdrawal Engine:** Monte-Carlo powered aggregation of all income streams.
- **Unified UI:** Standardized views for Design, Track, and Import.

## Integrated Modules

- **Portfolio Manager:** Merton-inspired dynamic amortization.
- **Bond Ladders (TIPS):** Headless ladder-building and maintenance engine for inflation-protected income floors.
- **Social Security:** Estimated lifetime benefits.
- **Pension:** Fixed benefit tracking.

The TIPS engine lives in `@fin-plan/tips-engine`. Its package README covers the ladder methodology, MIT-licensed Aerokam attribution, rebalance behavior, and usage details:

- [`packages/tips-engine/README.md`](./packages/tips-engine/README.md)

## Development

```bash
bun install
bun run dev
```
