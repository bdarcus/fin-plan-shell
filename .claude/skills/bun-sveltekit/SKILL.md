---
name: bun-sveltekit
description: Patterns and constraints for building with Bun + SvelteKit. Use this skill whenever working on this project's frontend, backend routes, API endpoints, database access, testing, or build configuration. Trigger on any task involving SvelteKit components, Svelte stores, form actions, load functions, server routes, SQLite, or the Bun runtime. If the user asks to add a feature, fix a bug, or write tests in this codebase, consult this skill first.
---

# Bun + SvelteKit Skill

This project uses SvelteKit with Bun as the runtime. Many default tool choices are wrong here — use this skill to get it right.

## Runtime: Always Bun

| ❌ Don't use                  | ✅ Use instead                   |
| ----------------------------- | -------------------------------- |
| `node`, `ts-node`             | `bun <file>`                     |
| `npm`, `yarn`, `pnpm`         | `bun install` / `bun run`        |
| `npx`                         | `bunx`                           |
| `jest`, `vitest`              | `bun test`                       |
| `webpack`, `esbuild` directly | `bun build`                      |
| `dotenv`                      | (Bun loads `.env` automatically) |

## APIs: Bun-native over Node

| ❌ Don't use                   | ✅ Use instead         |
| ------------------------------ | ---------------------- |
| `express`                      | `Bun.serve()`          |
| `better-sqlite3`               | `bun:sqlite`           |
| `ioredis`                      | `Bun.redis`            |
| `pg`, `postgres.js`            | `Bun.sql`              |
| `ws`                           | `WebSocket` (built-in) |
| `fs.readFile` / `fs.writeFile` | `Bun.file()`           |
| `execa`                        | `Bun.$\`cmd\``         |

## Linting & Formatting Gate

```bash
bun run format   # Prettier
bun run lint     # ESLint
bun test         # bun:test
```

Never use `bunx biome check --write --unsafe .` as the gate here.

## SvelteKit Patterns

### Load functions (server)

```ts
// src/routes/+page.server.ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
	return { data: await fetchSomething(params.id) };
};
```

### Form actions

```ts
// src/routes/+page.server.ts
import type { Actions } from "./$types";

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		// handle...
	},
};
```

### Svelte stores

```ts
import { writable, derived } from "svelte/store";

export const portfolio = writable<Portfolio | null>(null);
export const totalValue = derived(portfolio, ($p) => $p?.totalValue ?? 0);
```

## Testing with bun:test

```ts
import { test, expect, describe, beforeEach } from "bun:test";

describe("MyModule", () => {
	test("does the thing", () => {
		expect(result).toBe(expected);
	});
});
```

Mock with `mock()` from `bun:test`, not `jest.fn()`.

## SQLite with bun:sqlite

```ts
import { Database } from "bun:sqlite";

const db = new Database("data.db");
const rows = db.query("SELECT * FROM bonds WHERE id = ?").all(id);
```

## Project Structure

```
packages/          # Shared logic (tips-engine, etc.)
src/
  routes/          # SvelteKit pages and API routes
  lib/             # Shared Svelte utilities
static/            # Public assets
tests/             # Integration/smoke tests
```

## Common Mistakes to Avoid

- Don't reach for `vite.config.ts` patterns — this uses `svelte.config.js`
- Don't use `import.meta.env` patterns from Vite — use `process.env` or `Bun.env`
- Don't add `express` or `fastify` for API routes — use SvelteKit server routes or `Bun.serve()`
- Don't use `@testing-library/jest-dom` matchers without checking bun:test compatibility
