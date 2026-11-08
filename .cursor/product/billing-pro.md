# Repdraft Pro (billing + recognize)

Pro v1 opens **program recognition** (photo / Excel → plan draft). Sacred loop, CSV history import, coach, and text `/ai` draft stay free. Text AI has a **daily quota** (default 10, shared with builder tune).

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
| `POST /api/ai/recognize-plan` | Auth + `userHasPro`; vision or exceljs |
| `POST /api/ai/plan`, `/api/ai/tune` | Free; `aiDailyQuota` (in-memory per instance) |

Domain: [`src/lib/domain/entitlement.ts`](../../src/lib/domain/entitlement.ts), [`recognizeProgram.ts`](../../src/lib/domain/recognizeProgram.ts). Gate: [`userHasPro`](../../src/lib/server/billing/requirePro.ts).

## Ops checklist

1. Apply SQL: `~/.repdraft-sql/billing-entitlements.sql` (not in public git).
2. Env (see `.env.example`):
   - `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` (+ amounts/currency)
   - and/or `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
   - `BILLING_DEFAULT_PROVIDER=yookassa|stripe`
   - `AI_VISION_MODEL=GigaChat-2-Max` (GigaChat-2 has no vision)
   - optional `AI_PLAN_DAILY_LIMIT=10`
3. YooKassa cabinet → HTTP notifications → `/api/billing/webhook/yookassa`
4. Stripe → webhook → `/api/billing/webhook/stripe` (`checkout.session.completed`, subscription events)
5. Manual ops grant: set Auth `app_metadata` (`pro`, `pro_until`, `pro_status`, `pro_plan`) and/or entitlements row; user must refresh session.

## Follow-ups (later minors)

- Durable AI quota (Supabase/Redis) instead of process Map
- Apply entitlements table everywhere + reconcile metadata
- YooKassa 54-FZ receipt if shop requires it
- Recognize UX polish (match quality, HEIC, errors)
- Native IAP only if App Store review requires it
