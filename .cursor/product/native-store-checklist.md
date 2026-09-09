# Native store release checklist (Capacitor)

Manual gate after `npm run build:native` + Xcode / Android Studio. Playwright stays web-only.

## Legal / operator (before any store submit)

1. Real `PUBLIC_PRIVACY_*` at **native build time** and on Vercel (not `.env.example` placeholders).
2. Lawyer review of `/privacy` + `/terms` (native shell, deep links, analytics disclosure).
3. Confirm signup + magic link require Terms/Privacy consent (`AuthLegalConsent`).
4. Confirm web analytics toggle is **hidden** in native shell (and never injects Vercel Analytics there).
5. Profile / guest settings link to Terms and Privacy.

## Mode A (server.url → Vercel)

1. Set `CAP_SERVER_URL=https://YOUR_DOMAIN` and run `npx cap sync`.
2. Install TestFlight / Play Internal build.
3. Sacred loop: Open → Pick workout → Preview → Start → Set → Weight × reps → Next → Finish → Saved.
4. Confirm auth sign-in/out against the live site.
5. Note: service worker may be flaky in WKWebView; Mode B is the store path.

## Mode B (static SPA in bundle)

1. `PUBLIC_SITE_URL` / `PUBLIC_WEB_ORIGIN` / Supabase `PUBLIC_*` / `PUBLIC_PRIVACY_*` set at build time.
2. `npm run build:native` (masks web-only API/og/sitemap routes, `cap sync`, deep-link patch).
3. Supabase Redirect URLs include `repdraft://auth` and `https://YOUR_DOMAIN/auth`.
4. Offline: airplane mode → catalog thumbs / index still open; live session wake lock holds.
5. Magic link / recovery opens app via `repdraft://auth`.
6. Delete account hits `PUBLIC_WEB_ORIGIN/api/account/delete` (CORS OK).
7. Haptics on set complete; status bar dark; splash not stuck white.
8. Share clip uses native sheet when available.
9. Weak Android + one TestFlight device: full sacred loop without jank.

## Store metadata

- iOS: privacy labels, account deletion path, screenshots of live logging.
- Android: Data safety form, `.aab` from Android Studio / `cap` build.
- Apple 4.2: Mode B offline + haptics + deep links before App Store submit.
