---
name: repdraft
description: >-
  Gym workout log: React Native (Expo in mobile/) + SvelteKit web/PWA, shared
  domain. Use when working in Repdraft: sacred loop UX, domain→storage→UI,
  catalog/workout flows, Supabase auth, Vercel web deploy.
---

# Repdraft

## Назначение

Дневник тренировок: каталог, builder, live (вес×повторы). **Polish священного цикла**, не feature count. См. [`mvp.mdc`](../../rules/mvp.mdc).

## Стек и команды

| | |
|---|---|
| Phone | React Native + Expo Router (`mobile/`) |
| Web | SvelteKit 2, Svelte 5, Tailwind 4, PWA |
| Domain | Shared pure TS `src/lib/domain` |
| Backend | Supabase (optional auth & sync) |
| Verify | `npm run check` + `npm run check:mobile` |
| Deploy web | Vercel |

```bash
npm install
cp .env.example .env
npm run dev              # web / PWA
npm run check            # svelte-check - before finishing web work
npm run check:mobile     # tsc in mobile/
npm run build

cd mobile && npm install && npm start
```

## Архитектура

1. **domain** - типы и чистая логика (без fetch/Supabase)
2. **storage** - local + Supabase (web) / AsyncStorage (RN)
3. **stores / RN state** - состояние сессии на клиенте
4. **routes / mobile/app** - UI (не шарится между web и RN)

Новый код в существующий слой. Не смешивай fetch внутрь `domain`.

**Parity:** для фич без native API добавляй web (`src/routes/` / components) и RN в одной задаче; см. [`dual-client-parity.mdc`](../../rules/dual-client-parity.mdc). Verify: `npm run check:parity`. i18n: только `src/lib/i18n/messages.ts`. Tokens: `src/lib/design/tokens.ts` + `npm run build:tokens`.

### Paths

| Path | Содержимое |
|------|------------|
| `src/lib/domain/` | типы, workout/session logic |
| `src/lib/storage/` | web local + Supabase repos |
| `mobile/` | Expo sacred-loop client |
| `src/routes/` | SvelteKit pages |
| `.cursor/product/` | rewrite plan, delivery |

## UX guardrails

- Одна primary CTA на экран. **Active Workout** - главный экран.
- **FAST ON WEAK DEVICES**
- Signup / magic link: consent Terms + Privacy
- Web analytics: opt-in
- Детали: [`native-rewrite-plan.md`](../../product/native-rewrite-plan.md), [`.cursorrules`](../../../.cursorrules)

## Что не делать

- Хардкод Supabase URL/JWT
- SQL/ops в публичный git
- Capacitor/Cordova поверх PWA (телефон - Expo в `mobile/`)
- Коммит без `npm run check` (web) / `check:mobile` (RN)
- Выдумывать реальные `PUBLIC_PRIVACY_*`

## MCP / env

`.cursor/mcp.json` - Supabase (read-only).

Env: `PUBLIC_SUPABASE_*`, `PUBLIC_SITE_URL`, `PUBLIC_PRIVACY_*`; mobile: `EXPO_PUBLIC_*` (см. `mobile/.env.example`).
