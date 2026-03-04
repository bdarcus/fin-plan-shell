# Financial Planning Platform (shell)

A modular, pluggable infrastructure for financial planning applications.

## Core Architecture

- **Registry System:** A centralized ModuleRegistry that manages all modules.
- **Withdrawal Engine:** Monte-Carlo powered aggregation of all income streams.
- **Unified UI:** Standardized views for Design, Track, and Import.

## Integrated Modules

- **Portfolio Manager:** Merton-inspired dynamic amortization.
- **Bond Ladders (TIPS):** Specialized engine for building guaranteed inflation-protected floors.
- **Social Security:** Estimated lifetime benefits.
- **Pension:** Fixed benefit tracking.

## Credits & Adaptations

The **Bond Ladder (TIPS)** module in this repository is an adaptation of the excellent [TipsLadderBuilder](https://github.com/aerokam/TipsLadderBuilder) project by **aerokam**. 

This implementation refactors the original logic into a reactive Svelte 5 module and extends it to support:
- Multi-ladder management (splitting between Roth, Traditional, and Taxable).
- Simplified income-only projection modes.
- Integration into a broader withdrawal-based planning ecosystem.

We are deeply grateful to aerokam for their work on the underlying bond rebalancing and duration matching algorithms.

## Development

```bash
bun install
bun run dev
```