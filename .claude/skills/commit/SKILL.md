---
name: commit
description: Run the full commit workflow for this project: format, lint, test, then create a conventional commit. Use this skill whenever the user says "commit", "ship it", "push this", "make a commit", "commit my changes", or asks to finalize/save their work. Also trigger when they say "done" after a coding task and there are uncommitted changes.
---

# Commit Skill

Run the full gate and commit in one shot. Never skip steps.

## Workflow

1. **Format** — `bun run format` (applies to all files Prettier covers: `.ts`, `.svelte`, `.md`, `.json`, etc.)
2. **Lint** — `bun run lint` (fix lint errors before proceeding)
3. **Test** — `bun test` (fix failures before proceeding)
4. **Stage** — add only relevant files (never `git add -A` blindly; exclude `.env`, secrets)
5. **Commit** — conventional commit message via HEREDOC

## Conventional Commit Format

```
<type>(<scope>): <short description>

[optional body]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`

Scope: package or area changed (e.g. `tips-engine`, `site`, `ui`)

## Example

```bash
bun run format
bun run lint
bun test
git add src/packages/tips-engine/calculator.ts src/packages/tips-engine/calculator.test.ts
git commit -m "$(cat <<'EOF'
feat(tips-engine): add clean-price normalization

Normalize bond prices to clean price before ladder optimization
to fix parity gap with TipsLadder benchmarks.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## If a Step Fails

- **Format fails**: Fix formatting issues, re-run format, continue
- **Lint fails**: Fix lint errors (don't use `--no-verify`), re-run lint
- **Tests fail**: Fix the failing tests or flag to user — never commit broken tests
- **Hook fails**: Investigate and fix the underlying issue; never use `--no-verify`

## Do Not

- `git add -A` or `git add .` without reviewing what's staged
- Commit `.env`, secrets, or generated build artifacts
- Use `--no-verify` or skip any gate
- Amend existing commits (create new ones)
