# Financial Planning Shell (`fin-plan-shell`)

A modular, pluggable infrastructure for financial planning applications. This shell provides the layout, registry system, and core withdrawal engine, allowing specialized financial modules to be "plugged in" as independent packages.

## Core Architecture

- **Registry System:** A centralized `ModuleRegistry` that manages the lifecycle, state, and UI mounting of all financial modules.
- **Withdrawal Engine:** A shared calculation engine that aggregates income streams from all enabled modules to project retirement viability.
- **View System:** Standardized routes for **Design** (configuration), **Track** (monitoring), and **Import** (data ingestion).

## Pluggable Modules

This shell is designed to consume modules that implement the `FinancialModule` interface. Currently supported internal modules:
- Portfolio Manager
- Social Security
- Pension
- Smart Withdrawals

## External Modules
- **TIPS Ladder:** Managed in the `TipsLadderBuilder` repository.

## Development

### Linking the TIPS Module
To work on the TIPS module locally within this shell:

1. In the `TipsLadderBuilder` directory:
   ```bash
   bun link
   ```

2. In this directory (`fin-plan-shell`):
   ```bash
   bun link @brucedarcus/tips-ladder
   ```

3. Register the module in `src/lib/index.ts`:
   ```typescript
   import { TipsLadderModule } from '@brucedarcus/tips-ladder';
   registry.register(TipsLadderModule);
   ```

### Installation
```bash
bun install
bun run dev
```
