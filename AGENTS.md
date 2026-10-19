# Repdraft - guide for humans and agents

**All agent / Cursor context lives in [`.cursor/`](.cursor/).** Start at [`.cursor/INDEX.md`](.cursor/INDEX.md).

## North star

Sacred workout loop. Not feature count. Fast on weak phones.  
[`.cursor/rules/mvp.mdc`](.cursor/rules/mvp.mdc) · [`.cursor/product/native-rewrite-plan.md`](.cursor/product/native-rewrite-plan.md).

## Stack

React Native (Expo in `mobile/`) + SvelteKit web/PWA. Shared `src/lib/domain`.

**Dual client:** ship web parity for non-native features (Quest, achievements, progress, profile, sacred loop on PWA). See [`.cursor/rules/dual-client-parity.mdc`](.cursor/rules/dual-client-parity.mdc). RN-first UX is fine; RN-only product surface is not, unless Health/watch/native modules.

## Commands

```bash
npm install
cp .env.example .env
npm run dev            # web / PWA
npm run mobile         # Expo (repo root)
npm run dev:all        # web + Expo together
npm run check          # web
npm run check:mobile   # tsc in mobile/
npm run check:all      # web + mobile typecheck
npm run check:parity   # tokens + versions + check:all
npm run build:tokens   # after editing src/lib/design/tokens.ts
npm run build
```

Shared copy: `src/lib/i18n/messages.ts` (both clients). Shared colors/spacing: `src/lib/design/tokens.ts`.

Legal before public: real `PUBLIC_PRIVACY_*` in Vercel; lawyer review `/privacy` + `/terms`. Web analytics off by default.

## Mobile notes

- **Expo Go SDK:** app targets Expo SDK 57. If Go mismatches, install from [expo.dev/go](https://expo.dev/go) or use a development build.
- **Turnstile:** Cloudflare captcha is web-only for now. RN auth in Expo Go has no Turnstile widget; test signup/reset on web when captcha is required in Supabase.
- **Health read:** Apple Health / Health Connect needs a **development build** + config plugins (not Expo Go). Toggle lives in Profile; adapter is stub until native modules are wired. See `mobile/src/health/`.
- **Watches:** separate native UI; ownership spike in [`.cursor/product/watch-session-ownership.md`](.cursor/product/watch-session-ownership.md).

## Secrets

Keys in `.env` / hosting only. SQL ops out of public git.

## Releases

Branch `feat/vX.Y.Z-slug` (or repo convention), GitHub Release with same tag, bump `package.json` `version` in the same PR.
