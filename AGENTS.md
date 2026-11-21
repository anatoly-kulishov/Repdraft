# Repdraft - guide for humans and agents

**All agent / Cursor context lives in [`.cursor/`](.cursor/).** Start at [`.cursor/INDEX.md`](.cursor/INDEX.md).

## North star

Sacred workout loop. Not feature count. Fast on weak phones. 
[`.cursor/rules/mvp.mdc`](.cursor/rules/mvp.mdc) · [`.cursor/product/native-rewrite-plan.md`](.cursor/product/native-rewrite-plan.md).

## Stack

React Native (Expo in `mobile/`) + SvelteKit web/PWA. Shared `src/lib/domain`.

**Dual client:** ship web parity for non-native features (import, coach mode, progress, profile, sacred loop on PWA). See [`.cursor/rules/dual-client-parity.mdc`](.cursor/rules/dual-client-parity.mdc). RN-first UX is fine; RN-only product surface is not, unless Health/watch/native modules.

## Commands

```bash
npm install
cp .env.example .env
npm run dev # web / PWA
npm run mobile # Expo (repo root)
npm run dev:all # web + Expo together
npm run check # web
npm run check:mobile # tsc in mobile/
npm run check:all # web + mobile typecheck
npm run check:parity # tokens + versions + check:all
npm run test:e2e # Playwright on the production build (:4199)
npm run build:tokens # after editing src/lib/design/tokens.ts
npm run build
# Web prod: RF VPS https://www.repdraft.ru (GitHub Actions on main, or npm run deploy:vps)
```

**E2E:** Playwright covers the web/PWA only (RN is `check:mobile`). Tests run against `npm run build` + `node build`, hermetic (Supabase/AI/billing blanked), on a `ru-RU` context. First run needs `npm run test:e2e:install`; see [`.cursor/product/testing.md`](.cursor/product/testing.md). `.github/workflows/e2e.yml` runs them on every PR to `main`.

Shared copy: `src/lib/i18n/messages.ts` (both clients). Shared colors/spacing: `src/lib/design/tokens.ts`. Canonical site: `https://www.repdraft.ru`.

**Public content:** `/tools/*` (4 calculators), `/programs/*` (4-week templates) and `/exercise/:id` mirrors under `/en/...` with self-canonical + `hreflang` (`ru` / `en` / `x-default` = RU). Calculators, plan generation and session ratings all run locally - nothing is sent to the server. Overview: [`.cursor/product/public-tools.md`](.cursor/product/public-tools.md); URL rules: [`.cursor/product/seo-cutover-ru.md`](.cursor/product/seo-cutover-ru.md).

Legal before public: real `PUBLIC_PRIVACY_*` on the web host (fills `/legal/requisites` too); lawyer review `/privacy`, `/terms` (offer) + refund rules. RKN notification and RF data localization (Supabase cloud is abroad) are open ops items - see [`.cursor/product/legal-compliance.md`](.cursor/product/legal-compliance.md).

## Mobile notes

- **Expo Go SDK:** app targets Expo SDK 58 - matches the current Expo Go on iOS. For native modules (Health) or stable runs use a dev build: `npx expo run:ios --device` (needs `expo-dev-client` + Apple ID in Xcode for signing).
- **Turnstile:** Cloudflare captcha is web-only for now. RN auth in Expo Go has no Turnstile widget; test signup/reset on web when captcha is required in Supabase.
- **Health read:** Apple Health / Health Connect needs a **development build** + config plugins (not Expo Go). Toggle lives in Profile; adapter is stub until native modules are wired. See `mobile/src/health/`.
- **Watches:** separate native UI; ownership spike in [`.cursor/product/watch-session-ownership.md`](.cursor/product/watch-session-ownership.md).
- **Coach mode:** web `/clients` + RN `/clients` (not `/coach` - that screen is self-hints). Invite accept and disconnect live in Profile. Cloud RPCs need SQL from `~/.repdraft-sql/` (`coach-mode.sql`, then `coach-session-detail-and-client-revoke.sql`). Product loop: [native-rewrite-plan.md phase F](.cursor/product/native-rewrite-plan.md).
- **Pro billing:** web checkout (YooKassa / Stripe); RN opens the site. Pro unlocks photo/Excel program recognition only. Free text `/ai` + tune share a daily quota. Ops: [billing-pro.md](.cursor/product/billing-pro.md); SQL `~/.repdraft-sql/billing-entitlements.sql`. Local probe (no secret dump): `npm run check:billing`. Prod needs the same `YOOKASSA_*` / `STRIPE_*` on the RF VPS `.env` plus the YooKassa webhook URL.

## Secrets

Keys in `.env` / hosting only. SQL ops out of public git. Billing keys: `YOOKASSA_*` / `STRIPE_*` / `AI_VISION_MODEL` (see `.env.example`). Until shop keys are set, Profile shows «Оплата временно недоступна» and `GET /api/billing/checkout` returns `"available":false`.

## Web hosting

- Canonical: `https://www.repdraft.ru` (RF VPS, not Vercel).
- Autodeploy: push/merge to `main` → workflow `Deploy web (RF VPS)`.
- Manual: `PUBLIC_SITE_URL=https://www.repdraft.ru npm run build && npm run deploy:vps`.
- Ops notes: [`.cursor/product/rf-access.md`](.cursor/product/rf-access.md), SEO: [`.cursor/product/seo-cutover-ru.md`](.cursor/product/seo-cutover-ru.md).

## Releases

Branch `feat/vX.Y.Z-slug` (or repo convention), GitHub Release with same tag. In the same PR: bump `package.json`, `mobile/package.json` and `mobile/app.json`, add a `CHANGELOG.md` section and a `src/lib/domain/changelog.ts` entry (the in-app "What's new"). Update agent docs under `.cursor/product/` when hosting/SEO/deploy changes.
