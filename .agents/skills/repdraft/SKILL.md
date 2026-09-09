---
name: repdraft
description: >-
  Fitness PWA + Capacitor shell (SvelteKit 5 + Supabase + Playwright). Use when
  working in repdraft: sacred loop UX polish, domain→storage→stores→routes,
  catalog/workout flows, Supabase auth, PWA, native Mode B, Vercel deploy.
---

# Repdraft

## Назначение

Fitness PWA (и Capacitor shell): каталог упражнений, конструктор тренировок, live-сессия с записью вес×повторы. **Главная цель — polish священного цикла**, не новые фичи. См. [`GOAL.md`](GOAL.md).

## Стек и команды

| | |
|---|---|
| Framework | SvelteKit 2, Svelte 5, TypeScript |
| UI | Tailwind 4, mobile/PWA first |
| Backend | Supabase (auth, optional sync) |
| Native | Capacitor Mode B (`npm run build:native`) |
| Test | Playwright (`tests/e2e/`), domain selfchecks |
| Deploy | Vercel (web); store via native checklist |

```bash
npm install
cp .env.example .env   # PUBLIC_SUPABASE_* / PUBLIC_PRIVACY_* при необходимости
npm run dev            # LAN: --host
npm run check          # svelte-check — обязательно перед завершением
npm run build
npm run build:native   # static SPA + cap sync (store path)
npm run test:e2e       # Playwright
npm run check:domain   # domain selfchecks
```

Store gate: [`.cursor/product/native-store-checklist.md`](../../.cursor/product/native-store-checklist.md).

## Архитектура (слои)

1. **domain** — типы и чистая логика (без fetch/Supabase)
2. **storage** — local + Supabase репозитории
3. **stores** — состояние сессии
4. **components / routes** — UI

Новый код клади в существующий слой. Не смешивай fetch внутрь `domain`.

### Paths

| Path | Содержимое |
|------|------------|
| `src/lib/domain/` | типы, фильтры, workout/session logic |
| `src/lib/storage/` | local + Supabase repos |
| `src/lib/stores/` | auth, live session |
| `src/lib/app/` | native detect, deep links, chrome |
| `src/routes/` | SvelteKit pages (`/privacy`, `/terms`, …) |
| `.cursor/product/` | MVP spec, UX research, native store checklist |
| `tests/e2e/` | Playwright (sacred loop, auth consent, history) |

## UX guardrails

- Одна primary CTA на экран. **Active Workout** — главный экран.
- Полировка существующего экрана важнее новой кнопки/раздела.
- **FAST ON WEAK DEVICES:** списки, медиа, импорт и live должны оставаться отзывчивыми на слабом/старом телефоне.
- Signup / magic link: consent Terms + Privacy (`AuthLegalConsent`).
- Web analytics: opt-in, web-only (never native shell).
- Язык UI: `/auth` (Профиль), остальное — по контексту i18n.
- Детали: [`.cursor/product/mvp-spec.md`](../../.cursor/product/mvp-spec.md), [`.cursorrules`](../../.cursorrules).

## Что не делать

- Хардкод Supabase URL/JWT в коде
- SQL/ops-скрипты в публичный репо (см. `.gitignore`)
- Дублировать primary CTA в одном вьюпорте
- Тяжёлый encode на main thread на телефоне
- Push без явного запроса пользователя
- Коммит без `npm run check`
- Выдумывать реальные `PUBLIC_PRIVACY_*` (operator identity)

## MCP / env

Project MCP: `.cursor/mcp.json` — Playwright + Supabase (read-only, project-scoped).

Env (см. `.env.example`): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`, `PUBLIC_PRIVACY_*` (required before public/store), optional `PUBLIC_WEB_ORIGIN` / `PUBLIC_APP_NATIVE` / Turnstile. Server-only: `SUPABASE_SERVICE_ROLE_KEY` для delete account.

Длинные сессии: `.cursor/agent-state.json`.
