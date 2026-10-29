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

## Fixed in v0.22.1 small-screen pass (2026-10-19, 360x640 web)

- RN live scroll no longer adds `bottomPad + 200` under a sibling footer. Content padding is `space.lg`.
- RN builder list and pick list use `space.lg` under a sibling sticky bar. Selection no longer grows the pad by 68px.
- Web history date preset uses `history.filterToday` (same key as RN). `home.today` stays for relative dates.
- Web plan rows: 48px move up / down. On phone the rest of the action cluster stays hidden (swipe). Measured 48x48, no horizontal overflow.
- Web live at 360x640: finish bar in view (79px), workspace pad follows `--sticky-actions-h` (coachmark raises it). No clip.
- Web builder sticky does not overlap the tab bar (tab bar hidden on that screen). Group bar already stacks under 390px with 48px buttons.
- ConfirmSheet finish offer passes `showCancel: false` (Later without a second Cancel).

## Dual-client UI parity (2026-10-21, v0.22.3)

Best-of-both pass across parity screens (i18n keys, spacing, CTAs). Fixed:

- RN plan preview: `preview.stats` / `preview.edit` / `builder.orBadge` (RU grammar + same labels as web)
- RN home: drop duplicate `workouts.lead`; guest points with icons
- RN live: `live.progress`, `live.confirmDiscard`, `live.confirmSkipExercise` with name
- RN summary: title hierarchy, volume delta i18n, `setKindMessageKey`, sticky View details CTA
- RN history list: pagination, empty CTA, `workouts.historyMeta`, day eyebrow
- RN history detail: delete confirm, notes, no-logged-sets row, 48px card head, set kind labels
- RN workouts: remove per-row long-press hint noise
- RN builder: 48px steppers, `builder.or` label, empty AI CTA, `builder.orBadge`
- RN coach: navigate to builder without success Alert
- RN achievements / articles / records: progress count in panel; `articles.search`; `records.emptyTitle`
- Web exercises hub lead → `exercises.hubLead`; articles sections → `gettingStarted` / `more`
- Web profile: rest haptic toggle (`restHapticEnabled`); live ticker gates sound vs haptic separately

Intentional still ok: grain/Inter/CTA gradient web-only; Health RN-only; draft vs plan-picker on exercise detail; RN history 7d/30d/90d chips vs web custom range.

## Still watch for (manual QA)

- RN device pass of the same footer heights (this pass was web + code). Expo Go was not running.
- Technique clips / related articles on RN exercise detail (still web-first).
- Web records inline edit (RN has edit card; web keeps swipe + undo).

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

## Redesign pass (2026-10-29, v0.23.7)

Сквозной проход по трём экранам + общий UI-кит. Web и RN в одной задаче, токены общие.

- **8-pt сетка и токены.** `bg #F4F3F8`, карточки `#FFFFFF`, акцент `#6B34C9`, `muted #7E7984`, `secondary #6750A4`, `success #2E7D32`. Аддитивные `mutedSoft` / `secondary` / `success` + `radius.tag` / `radius.control`; старые токены не переименовывались.
- **Клиенты (web + RN).** Компактный инвайт вместо свёрнутого блока, поиск при 5+ клиентах, строка «Последняя: план · когда», сводка «Активны за 7 дней», скелетоны. Desktop ≥1280px - две колонки (360px + 1fr), `max-width 72rem`; ≤380px - компактные строки.
- **Главная (web + RN).** Hero-CTA с `planEstimatedMinutes` и составом, карточки 30 дней с недельной динамикой (`finishedSessionsBetweenDays`), `formatRelativeDayShort` без «—» и «N дн. назад».
- **Прогресс (web + RN).** Вынесен в компоненты, период переключает весь экран, дельты к прошлому окну.
- **«Часто тренируете».** `frequentExercises()` (90 дней, рабочие подходы) + cold-start `POPULAR_EXERCISE_IDS`; веб - рейл на хабе, RN - `FrequentExercisesRail` в футере списка.
- **Помощь «?».** `HelpButton` + `HelpPanel` на вебе (Прогресс, Итоги, Клиенты). Панель inline под хедером, поэтому на sticky-хедерах (Records, карточка плана, Live, Auth) нужен поповер-вариант.
- **Адаптив.** Прогон всех маршрутов на 320/360/390/414/768/1024/1280/1440/1920 после снятия `data-boot-pending`: `overflowX = 0`, таб-бар не переносится.
- **Favicon.** Скруглённая градиентная плашка RP; ссылки root-relative + `v15`, чтобы localhost не тянул прод-кэш.

Still open: RN help on Progress/Summary, поповер для sticky-хедеров, назначение плана клиенту (SQL).
