# RN visual backlog (cycle 1)

Living list from theme + screen pass. Plan file is not edited; findings land here.

## Fixed in theme migration

- Static `colors` (always dark) on live, plan, builder, exercises, history, summary, exercise, records, ai, TechniqueSheet, CatalogThumb, WhatsNewSheet → `useAppColors` + `makeStyles`

## Fixed in per-screen pass (2026-10-16)

- Tab lists: `useTabScreenPad` on Home, Exercises, Profile (no content under tab bar)
- Stack lists: `useBottomChromePad` on history, records, exercise detail
- Sticky footers: scroll `paddingBottom` = footer estimate + home indicator on live, plan, summary, builder (+ builder pick list)
- Keyboard: `useStackHeaderOffset` on live, ai, builder pick mode
- Exercises hub zone cards: light caption text on image scrim (light theme)
- Exercises custom sheet: `overlayScrim` token (light/dark)
- History filter chips: solid accent selected state; builder zone chips localized

## Dual-client sync phase 2 (2026-10-18)

Shared: `src/lib/design/tokens.ts` + one i18n file. Visual parity pass:

- RN `BottomSheet` shell (web twin API: open / onDismiss / actions / raised)
- Migrated: WhatsNewSheet, TechniqueSheet, QuestOnboardingSheet, AchievementUnlockSheet, exercises custom, live ConfirmSheet (finish / skip / discard / switch / remove set)
- PrimaryButton primary fill → `accentFill`; link → `accentLink`
- Chip selected → `accentFill` + accent ink (web Chip same)
- Sacred loop: Home hero uses Panel + PrimaryButton; plan/live/summary cards use Panel; live nav uses Chip

### Playwright visual QA (2026-10-18)

Fixed:
- Tabbar grid was `repeat(3)` with 4 tabs → wrapped to 2 rows (~28px hits). Now `repeat(4)`.
- `Chip` inactive used Tailwind `text-muted` → shadcn plate color (near-invisible). Now product `--color-muted`.
- `AppChip` / catalog hub chips: min-height → 48px (`--control-height`).
- Achievements `Chip`: `min-w-12` (short labels like "All" were 44px wide).
- AI draft example chips: were `2.25rem` override → `--control-height`.
- AI clear / mic: 36px → 48px; brief padding follows.
- RN `Chip`: `minWidth: touchMin` to match.

### web↔RN gaps (still ok / intentional)

| Area | Web | RN | Notes |
|---|---|---|---|
| CTA wash | gradient + accentFill | flat accentFill | no gradient lib on RN |
| Atmosphere | film grain, Inter | system font, flat | web-only |
| Articles / legal | routes | WebBrowser from profile | ok |
| Health | stub / hide | native adapters | native-only |
| Live confirms | BottomSheet | ConfirmSheet (same shell) | aligned |
| Filter chips on home | none | none | both unused on loop |

## Still watch for (manual QA)

- Live footer height when "Next exercise" + finish + undo row all visible (scroll pad is generous)
- Builder group selection bar height varies; list pad grows when selection non-empty
- Very small devices: tab bar + sticky footer together on long builder cards
- ConfirmSheet always adds Cancel under custom actions (Later + Cancel both appear on finish-offer)

## Closed for gate

Theme wiring complete; tab/footer/keyboard padding is code-level. Remaining items are device-specific polish.

## P0 sacred loop QA (2026-10-18)

Code-level blockers for Open → plan → live → finish → summary: none found in this pass.

- Web tabbar aligned to Home / Exercises / Progress / Profile (Workouts under Home)
- Chips shared via `Chip` on achievements (web), exercises + history (RN)
- Light BrandMark / PrimaryButton / Panel tokens already shipped in Quest branch
- Device-specific: live footer stack height, builder selection bar - still watch on small phones
- Health Connect: Android scaffold in `mobile/src/health/androidHealthAdapter.ts` (dev build only; Expo Go stays stub)
- Watch ownership: still deferred per `watch-session-ownership.md`
