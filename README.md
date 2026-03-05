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

## Credits & Invariants

The **Bond Ladder (TIPS)** module in this repository is a clean-room, independent implementation of a Liability-Driven Investment (LDI) solver. It was developed to provide a mathematically rigorous and legally unencumbered engine for the open-source community.

While this engine is an original implementation, we acknowledge the following as key inspirations:

- **[TipsLadderBuilder](https://github.com/aerokam/TipsLadderBuilder)** by **aerokam**: Provided the initial inspiration for a web-based TIPS planning tool.
- **The Pfau/DARA Method**: The underlying reverse-chronological "Working Backward" strategy used to account for coupon drips.

This purpose-built engine includes:

- **Immunized Synthetic Rungs:** Uses Macaulay Duration to match Treasury maturity gaps.
- **Automated Rebalancing:** Generates specific BUY/SELL trade tickets when new bonds are auctioned.
- **Headless Architecture:** Isolated as a zero-dependency TypeScript package (`@fin-plan/tips-engine`).

## Development

```bash
bun install
bun run dev
```
