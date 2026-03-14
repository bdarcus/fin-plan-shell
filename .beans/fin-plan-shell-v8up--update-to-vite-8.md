---
# fin-plan-shell-v8up
title: Update to Vite 8.0 and Svelte March 2026 stack
status: in-progress
type: task
priority: medium
tags:
  - infrastructure
  - vite
  - bun
created_at: 2026-03-14T10:00:00Z
updated_at: 2026-03-14T10:00:00Z
---

## Summary

Vite 8.0 was released (March 12, 2026) featuring **Rolldown**, a Rust-based unified bundler that promises 10-30x faster builds. Svelte and SvelteKit have also released updates (March 2026) to support Vite 8 and introduce new security features (TrustedHTML, CSP-safe hydration).

## Upgrade Stack

- **Vite**: `^8.0.0` (Rolldown backend)
- **Svelte**: `^5.53.0` (TrustedHTML support, SSR error boundaries)
- **SvelteKit**: `^2.53.0` (Vite 8 support, CSP-safe hydration)
- **Vite Plugin Svelte**: `^7.0.0` (Vite 8 compatibility)
- **Vitest**: `^4.1.0` (Vite 8 compatibility)
- **Tailwind CSS**: `@tailwindcss/vite ^4.1.18` (Vite 8 compatibility)

## Considerations for Bun

- Vite 8 requires Node 20.19+ or 22.12+. Bun 1.2+ provides sufficient compatibility.
- Use `bunx --bun vite` for potentially faster dev execution.
- esbuild-specific options in `vite.config.ts` (if any) should be migrated to Rolldown options.

## Implementation Steps

1. Create a feature branch `update-vite-8`.
2. Update `package.json` dependencies.
3. Run `bun install` to regenerate the lockfile.
4. Verify with `bun run ci:verify` (lint, check, test).
5. Create a Pull Request.
