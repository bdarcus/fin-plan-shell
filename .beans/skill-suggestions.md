# Skill Suggestions

Generated: 2026-03-05

## Backlog

### 1. `bun-sveltekit` ⭐ High value

Primary stack has specific rules (no `vite`, Bun APIs over Node, `bun:sqlite`, ESLint+Prettier gate). Prevents wrong choices (express, better-sqlite3, vitest) and guides SvelteKit idioms (load functions, form actions, stores).

### 2. `commit` ⭐ High value

Full commit workflow: `bun run format` → `bun run lint` → `bun test` → conventional commit. One `/commit` invocation → done.

### 3. `financial-domain`

TIPS, bond pricing, Decimal.js precision math, inflation calculations. Codifies domain patterns: when to use Decimal vs native, clean-price vs dirty-price, FedInvest data handling.

### 4. `test-writer`

Generates `bun:test` tests from existing code knowing project patterns (packages structure, test file placement, mock patterns).

### 5. `debug-context`

Captures/restores debugging state across sessions: what was tried, current hypothesis, relevant logs. Helps continuity on complex multi-session bugs.

## Status

- [ ] bun-sveltekit — **created** (see ~/.claude/skills/bun-sveltekit/)
- [ ] commit — **created** (see ~/.claude/skills/commit/)
- [ ] financial-domain
- [ ] test-writer
- [ ] debug-context
