# Delivery: mobile + web

| Клиент | Стек | Роль |
|---|---|---|
| **Mobile** | React Native (Expo) в [`mobile/`](../../mobile/) | Основной gym-клиент |
| **Web / PWA** | SvelteKit в корне | Браузер, SEO, техника, миграция / backup |

Общее поведение: [`src/lib/domain`](../../src/lib/domain). UI и storage у каждого клиента свои.

**Не делать:** Capacitor / Cordova. Часы - отдельный native UI, не RN-экран.

Стратегия rewrite: [native-rewrite-plan.md](native-rewrite-plan.md).
