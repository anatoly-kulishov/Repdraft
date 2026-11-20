# Repdraft Pro (billing + recognize)

Pro v1 opens **program recognition** (photo / Excel → plan draft). Sacred loop, CSV history import, coach, and text `/ai` draft stay free. Text AI has a **daily quota** (default 10, shared with builder tune); photo recognition has its own cap (default 4/day) because the vision model costs ~10x a text call. Excel/CSV import is parsed locally and is never capped.

## Clients

| Surface | Behavior |
|---------|----------|
| Web `/auth` | Pro card for signed-in users only; month/year checkout |
| RN Profile | Status + «Оформить на сайте» (`WebBrowser` → `/auth?billing=1#pro`) |
| Web `/ai`, empty workouts, RN `/ai` / empty workouts | Recognize entry; paywall without Pro |

No native IAP in v1 (App Store / Play Billing deferred).

## Server

| Path | Role |
|------|------|
| `POST /api/billing/checkout` | YooKassa payment or Stripe Checkout Session |
| `POST /api/billing/webhook/yookassa` | Re-fetches payment via API; checks `paid` + amount; upserts entitlement |
| `POST /api/billing/webhook/stripe` | Signed Stripe events → entitlement |
| `GET/POST /api/billing/status`, `portal` | Status + manage/cancel |
| `POST /api/ai/recognize-plan` | Auth + `userHasPro`; photo → vision + `aiRecognizeQuota` (429 `rate_limit`), Excel/CSV → exceljs, no quota |
| `POST /api/ai/plan`, `/api/ai/tune`, `/api/ai/tune-plan` | Free; `aiDailyQuota` (one bucket, in-memory per instance) |

Domain: [`src/lib/domain/entitlement.ts`](../../src/lib/domain/entitlement.ts), [`recognizeProgram.ts`](../../src/lib/domain/recognizeProgram.ts). Gate: [`userHasPro`](../../src/lib/server/billing/requirePro.ts).

## Ops checklist

1. Apply SQL: `~/.repdraft-sql/billing-entitlements.sql` (not in public git).
2. Env **local** `.env` and RF VPS `/opt/repdraft/.env` (same names, see `.env.example`):
   - `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` (+ amounts/currency)
   - and/or `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
   - `BILLING_DEFAULT_PROVIDER=yookassa|stripe`
   - `SUPABASE_SERVICE_ROLE_KEY` (webhooks write entitlements + app_metadata)
   - `AI_VISION_MODEL=GigaChat-2-Max` (GigaChat-2 has no vision)
   - optional `AI_PLAN_DAILY_LIMIT=10` (text: plan / tune / tune-plan, one shared bucket)
   - optional `AI_RECOGNIZE_DAILY_LIMIT=4` (Pro photo recognition)
3. Probe without dumping secrets: `npm run check:billing`
4. YooKassa cabinet → HTTP notifications → `https://www.repdraft.ru/api/billing/webhook/yookassa` (events: `payment.succeeded`)
5. Stripe → webhook → `/api/billing/webhook/stripe` (`checkout.session.completed`, subscription + invoice events)
6. Smoke: `GET /api/billing/checkout` must return `"available":true` on prod; Profile → Pro shows month/year CTAs (not «Оплата временно недоступна»).
7. Manual ops grant: Auth `app_metadata` (`pro`, `pro_until`, `pro_status`, `pro_plan`) and/or entitlements row; user must refresh session. Metadata-only grants are **not** cancelable in UI.

## Лимиты GigaChat и стоимость вызова

Провайдер: `GIGACHAT_SCOPE=GIGACHAT_API_PERS` (физлицо), модель `GigaChat-2`, vision `GigaChat-2-Max`.
Условия Сбера меняются, цифры ниже сверены 2026-11-20 с [тарифами](https://developers.sber.ru/docs/ru/gigachat/api/tariffs) (обновлены 7 октября 2026) и [квотами и ограничениями](https://developers.sber.ru/docs/ru/gigachat/limitations) (19 ноября 2025).

| Что | PERS (сейчас) | Юрлицо / ИП |
|---|---|---|
| Параллельные потоки | **1** | 10 по умолчанию, больше — по заявке на gigachat@sberbank.ru |
| Freemium | 365 млн токенов на 12 мес: 250M Lite, 40M Pro, 25M Max, 50M Ultra | нет |
| Пакеты | 20M Lite 1 300 ₽, 3M Pro 1 500 ₽, 3M Max 1 950 ₽ (месяц) | 300M Lite 19 500 ₽, 50M Pro 25 000 ₽, 30M Max 19 500 ₽ (12 мес) |
| Pay-as-you-go | нет | Lite 0,065 ₽, Pro 0,5 ₽, Max 0,65 ₽ за 1k токенов, async вдвое дешевле, минимальный чек 600 ₽/мес |
| Коммерческое использование | **запрещено** без платного пакета | разрешено |
| Новые клиенты с 1 сентября 2026 | покупка моделей через cloud.ru | то же |

Расход на один вызов (оценка по промптам `tunePlan` / `visionProgram`):

- подстройка плана — ~2–2,5k токенов (система ~1,1k, каталог 40 строк ~0,9k, план и ответ ~0,4k) → ~0,15 ₽ на Lite, ~1,5 ₽ на Max;
- распознавание фото — картинка + промпт + JSON ~3k токенов на Max → ~2 ₽;
- Excel/CSV — 0 ₽ (локальный парсинг, exceljs).

Отсюда капы: 10 текстовых вызовов/сутки и 4 фото/сутки на пользователя. Оба счётчика живут в процессе (`Map`), сбрасываются при рестарте и не делятся между инстансами; на одном VPS это фактически глобальный лимит.

**Чек-лист перехода на юрлицо (перед продажами Pro):**

1. Оформить доступ ИП/юрлица, сменить `GIGACHAT_SCOPE` на корпоративный (`GIGACHAT_API_B2B` / `CORP`) и выпустить новый ключ.
2. Купить пакет или включить pay-as-you-go (минимальный чек 600 ₽/мес), выставить лимит расходов в кабинете.
3. Проверить, что 429 от провайдера больше не приходит на двух одновременных запросах (10 потоков), и что `AI_PLAN_DAILY_LIMIT` / `AI_RECOGNIZE_DAILY_LIMIT` всё ещё соответствуют цене подписки.
4. Пересчитать экономику Pro: 149 ₽/мес ≈ 70 фото на Max или ~900 подстроек на Lite.

**Риски, которые помним:**

- PERS = 1 поток, у нас один ретрай через 800 мс на 429 (`chat.ts`): два одновременных пользователя могут получить 502 и потерять списанный вызов.
- Freemium нельзя использовать в коммерческом продукте: это условие Сбера, а не наша настройка.
- Фото без капа — самый дорогой путь, поэтому кап стоит на vision, а не на Excel.

## Known product rules

- Pro unlocks **photo/Excel recognize** only. Text `/ai` + tune stay free (daily quota).
- Photo recognition is capped per account (`AI_RECOGNIZE_DAILY_LIMIT`, default 4). 429 → `recognize.quota` in the sheet, which points the athlete to Excel/CSV. A failed recognition still spends the call (the model ran), except `unavailable`, which is refunded.
- YooKassa is one-shot: cancel marks `canceled`, access until `current_period_end`. Renew stacks onto an open period; same `payment.id` is idempotent.
- RN opens web checkout (`/auth/pro`); no native IAP in v1.

## Follow-ups (later minors)

- Durable AI quota (Supabase/Redis) instead of process Map
- Queue or shed 429s from the provider (PERS has a single thread)
- YooKassa 54-FZ receipt if shop requires it
- Recognize UX polish (match quality, HEIC, errors)
- Native IAP only if App Store review requires it
