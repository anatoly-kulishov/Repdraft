# Delivery: mobile + web

| Клиент | Стек | Роль |
|---|---|---|
| **Mobile** | React Native (Expo) в [`mobile/`](../../mobile/) | Основной gym-клиент |
| **Web / PWA** | SvelteKit в корне | Браузер, SEO, техника, миграция / backup |

Общее поведение: [`src/lib/domain`](../../src/lib/domain). UI и storage у каждого клиента свои.

**Shared sync layer (одна правка → оба клиента):**

| Слой | Путь |
|---|---|
| Domain | [`src/lib/domain`](../../src/lib/domain) |
| i18n | [`src/lib/i18n/messages.ts`](../../src/lib/i18n/messages.ts) |
| Design tokens | [`src/lib/design/tokens.ts`](../../src/lib/design/tokens.ts) → `npm run build:tokens` |

**Parity:** новые product-фичи без native API - domain + i18n + web + RN в одной задаче, см. [dual-client-parity.mdc](../rules/dual-client-parity.mdc). Verify: `npm run check:parity`.

**Не делать:** Capacitor / Cordova. Часы - отдельный native UI, не RN-экран.

Стратегия rewrite: [native-rewrite-plan.md](native-rewrite-plan.md).
