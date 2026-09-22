# Repdraft — guide for humans and agents

Short contract. Cursor rules: [`.cursor/rules/`](.cursor/rules/). Coding rules: [`.cursorrules`](.cursorrules).

## North star

[`GOAL.md`](GOAL.md) — polish the sacred workout loop (open → pick → preview → train → finish). Not feature count. Stay fast on weak/old phones.

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
npm run check:ai # AI draft selfchecks (retrieve / adversarial)
npm run build
npm run test:e2e:history  # history detail delete / undo / edit save (release gate P0)
npm run test:e2e:guards   # SEO robots/sitemap, redirects, consent, analytics, ladder
```

Legal before public: set real `PUBLIC_PRIVACY_*` in Vercel (not placeholders); have a lawyer review `/privacy` + `/terms`. Web analytics is **off by default** (`repdraft:web-analytics`).

## Cursor rules map

| File | When |
|------|------|
| `.cursorrules` | Coding + UX rules (always) |
| `mvp.mdc` | Scope and north star (always) |
| `architecture.mdc` | Where code belongs (always) |
| `release-branches.mdc` | Branches, semver, `package.json` version (always) |
| `.cursor/skills/release-gate/` | Pre-release gate — say `release gate` or `релиз-гейт` |
| `svelte-ts.mdc` | TS/Svelte conventions (`src/**`) |
| `supabase-auth.mdc` | Auth dashboard checklist (on demand) |
| `refactor-guardrails.mdc` | Large CSS/architecture refactors (on demand) |
| `tech-debt.mdc` | Backlog pointer (on demand) |
| `agent-inbox.mdc` | Phone dumps → Issues triage / implement (on demand) |
| `ru-gym-names.mdc` | Catalog `name_ru` gym jargon (on demand) |
| `.cursor/skills/ru-gym-names/` | Full rubric for Russian exercise titles |

Product: [`.cursor/product/mvp-spec.md`](.cursor/product/mvp-spec.md). Legal: `/privacy` + `/terms`.

## Bugs / ideas from phone (agent inbox)

Capture in **GitHub Issues** (templates: Inbox / Bug / Idea). Workflow + Agent card format: [`.cursor/product/agent-inbox.md`](.cursor/product/agent-inbox.md).

In Cursor: `оформи inbox` · `оформи issue #N` · `сделай issue #N`.

Bad exercise title on a screenshot: fix with [`.cursor/skills/ru-gym-names/SKILL.md`](.cursor/skills/ru-gym-names/SKILL.md) (`npm run translate:names`).

## Secrets

Keys in `.env` / hosting only. SQL ops scripts stay out of public git (see `.gitignore`).

Supabase Auth setup: [`.cursor/rules/supabase-auth.mdc`](.cursor/rules/supabase-auth.mdc).

Draft with AI (`/ai`, `POST /api/ai/plan`): private `AI_PROVIDER` + `GIGACHAT_*` or `OLLAMA_*`. Optional; offline / missing keys degrade the AI UI only — sacred loop unchanged. Legacy `/lab/ai` redirects to `/ai`.

## Releases

Branch `feat/vX.Y.Z-slug` (or repo convention), GitHub Release with same tag, bump `package.json` `version` in the same PR.
