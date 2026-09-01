# Repdraft — guide for humans and agents

Short contract. Cursor rules: [`.cursor/rules/`](.cursor/rules/). Coding rules: [`.cursorrules`](.cursorrules).

## North star

[`GOAL.md`](GOAL.md) — polish the sacred workout loop (open → pick → preview → train → finish). Not feature count.

## Stack

SvelteKit, TypeScript, Tailwind 4, Supabase (optional), mobile / PWA first.

## Layers

`domain` → `storage` → `stores` → `routes` / `components`. Details: [`.cursor/rules/architecture.mdc`](.cursor/rules/architecture.mdc).

## Commands

```bash
npm install
cp .env.example .env
npm run dev
npm run check    # before finishing a task
npm run build
```

## Cursor rules map

| File | When |
|------|------|
| `.cursorrules` | Coding + UX rules (always) |
| `mvp.mdc` | Scope and north star (always) |
| `architecture.mdc` | Where code belongs (always) |
| `release-branches.mdc` | Branches, semver, `package.json` version (always) |
| `svelte-ts.mdc` | TS/Svelte conventions (`src/**`) |
| `supabase-auth.mdc` | Auth dashboard checklist (on demand) |
| `refactor-guardrails.mdc` | Large CSS/architecture refactors (on demand) |
| `tech-debt.mdc` | Backlog pointer (on demand) |

Product detail: [`.cursor/product/mvp-spec.md`](.cursor/product/mvp-spec.md).

## Secrets

Keys in `.env` / hosting only. SQL ops scripts stay out of public git (see `.gitignore`).

Supabase Auth setup: [`.cursor/rules/supabase-auth.mdc`](.cursor/rules/supabase-auth.mdc).

## Releases

Branch `cursor/vX.Y.Z-slug`, GitHub Release with same tag, bump `package.json` `version` in the same PR.
