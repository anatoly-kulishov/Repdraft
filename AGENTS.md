# Repdraft - guide for humans and agents

**All agent / Cursor context lives in [`.cursor/`](.cursor/).** Start at [`.cursor/INDEX.md`](.cursor/INDEX.md).

## North star

Sacred workout loop. Not feature count. Fast on weak phones.  
[`.cursor/rules/mvp.mdc`](.cursor/rules/mvp.mdc) · [`.cursor/product/native-rewrite-plan.md`](.cursor/product/native-rewrite-plan.md).

## Stack

React Native (Expo in `mobile/`) + SvelteKit web/PWA. Shared `src/lib/domain`.

## Commands

```bash
npm install
cp .env.example .env
npm run dev            # web / PWA
npm run mobile         # Expo (repo root)
npm run dev:all        # web + Expo together
npm run check          # web
npm run check:mobile   # tsc in mobile/
npm run check:all      # web + mobile
npm run build
```

Legal before public: real `PUBLIC_PRIVACY_*` in Vercel; lawyer review `/privacy` + `/terms`. Web analytics off by default.

## Secrets

Keys in `.env` / hosting only. SQL ops out of public git.

## Releases

Branch `feat/vX.Y.Z-slug` (or repo convention), GitHub Release with same tag, bump `package.json` `version` in the same PR.
