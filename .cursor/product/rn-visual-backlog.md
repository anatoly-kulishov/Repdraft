# RN visual backlog (cycle 1)

Living list from theme + screen pass. Plan file is not edited; findings land here.

## Fixed in theme migration

- Static `colors` (always dark) on live, plan, builder, exercises, history, summary, exercise, records, ai, TechniqueSheet, CatalogThumb, WhatsNewSheet → `useAppColors` + `makeStyles`

## Still watch for (manual QA)

- Sticky footers vs home indicator on live / plan / builder / summary
- Light mode: chip/text contrast on `accentDim` rows
- Keyboard covering weight/reps inputs on live
- Sheet scrims on TechniqueSheet / WhatsNew in light theme
- Home long-press pin-next: toast `home.setNextPlanDone` (done)
- Sheet scrims: `overlayScrim` token on TechniqueSheet / WhatsNew (done)
- i18n: mobile messages synced from web via `npm run sync-mobile-i18n` (done)

## Closed for gate

Theme wiring complete; critical blockers for light/dark sacred loop are code-level. Remaining items are polish during device QA.
