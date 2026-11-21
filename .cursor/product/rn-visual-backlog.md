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
- AI draft example chips: flat 2.25rem pills + `::after` ≥48 hit (short labels no longer look circular).
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

## Coach assignment (2026-10-29, v0.23.8)

- Тренер: «Назначить тренировку» в раскрытой карточке клиента → `AssignPlanSheet` (web `CoachAssignSheet`).
- Клиент: карточка «Тренер назначил план» на Главной (`HomeAssignmentCard`) и в профиле (`AssignedPlanCard`); «Добавить план» = локальный план + `homeNextPlan` pin, затем `discardAssignment`.
- Снимок плана (не ссылка): `parseCoachPlanExercises` в shared domain, self-check в `runCoachSelfCheck`.
- SQL вне git: `~/.repdraft-sql/coach-plan-assignment.sql` (таблица + 4 RPC, RDC06/07/08).
- Home не блокируется: назначение грузится после `getSession`, баннер появляется по факту ответа.

## Invite card: одна копия, один share (2026-10-29)

До правки на экране «Клиенты» было 4–5 точек входа под одно действие: иконка копирования в плашке + пункт «Скопировать» в ⋮, серая иконка share + primary «Поделиться» в пустой карточке.

- Плашка кода целиком стала кнопкой копирования (`Pressable` в RN, `<button class="coach-code-plate">` на вебе); иконка внутри - только подсказка, после тапа `Check` на 1.5 с.
- «Поделиться» - единственная primary-CTA карточки (акцентная кнопка на всю ширину), серая иконка-квадрат удалена.
- Из пустой карточки «У вас пока нет клиентов» убран второй CTA: код и кнопка уже в блоке «Приглашение» выше. `inviteFirstClient` в `useCoachClients` удалён как мёртвый.
- ⋮ остался только для редкого разрушающего «Обновить код» (+ confirm); дубль «Скопировать» из меню и из `InviteSheets` убран.
- Web parity: markup + `coach.css` (`.coach-code-row` и `.coach-share` удалены, у плашки hover/focus-ring).

## Live + history pass (2026-11-20, v0.25.22)

- **Живой экран: один совет, без дубля.** Кнопка «Как в прошлый раз» под подходом убрана; подсказка `nextWeightHint` («Повтори 80 кг × 6») осталась единственной. Web `LiveSetPanel` и RN `LiveSetRow` синхронны, ключи `live.applyLast` / `live.lastApplyAria` удалены, самозаполнение из истории (`fillOpenWeightsFromHistory`) не тронуто.
- **История: тип подхода на строке с номером.** Плитка стала grid `"i kind" / "value value"`: чип «В отказ» прижат вправо, значение `вес × повторы` держит одну базовую линию во всех плитках, четвёртый подход больше не растягивается на всю строку, длинное значение расширяет плитку вместо переполнения.
- **Закрыто 2026-11-21:** тип подхода теперь есть и в RN-истории, см. раздел ниже.

## Programs + history kinds + builder kit (2026-11-21)

Три места, которые жили только на вебе, доведены до RN на общем домене.

- **Программы.** Новые `/programs` и `/programs/[slug]` (`mobile/app/programs/`),
  состояние в `mobile/src/program/usePrograms.ts`, хранилище в
  `mobile/src/storage/programsRepo.ts`. Ключи те же, что на вебе
  (`PROGRAM_RUNS_STORAGE_KEY`, `SAVED_PROGRAMS_STORAGE_KEY`), поэтому прогон,
  закладки и парсеры (`parseProgramRuns`, `parseSavedPrograms`) одни на два клиента.
- Карточка хаба повторяет веб: уровень, недели, частота, время
  (`programSessionMinutes`), чипы инвентаря, закладка, сохранённые сверху.
- Старт слота идёт тем же путём: `buildSessionExercises` с инвентарём программы ->
  локальный план -> `programsRepo.startSlot` -> `seedOpenSetsFromLastPerformance`
  -> `/live/:id`. Активная сессия не перетирается, предлагается открыть её.
- Вход в RN: карточка «Библиотека» на вкладке «Тренировки», рядом с циклом.
- **Тип подхода в истории.** Плитка подхода получила чип как на вебе:
  `setKindMessageKey`, grid «номер слева, тип справа», значение `вес × повторы`
  ниже. Гэп из раздела v0.25.22 закрыт.
- **Инвентарь в билдере.** Второй ряд чипов под мышцами из
  `equipmentFacets(catalog, 10)`; фильтр уже поддерживался
  `filterExercises(..., { equipment })`. Строка упражнения теперь показывает
  `labelBodyPart` / `labelEquipment` вместо сырых значений каталога.
- **Сырые i18n-ключи.** Нашлись два: `workouts.moveUp` / `workouts.moveDown`
  (теперь `builder.*`) и `common.save`. Чтобы такое не всплывало на экране,
  добавлен `npm run check:i18n` (`scripts/check-i18n-usage.mjs`): литеральные
  ключи `tt()` / `translate()` в обоих клиентах сверяются с `messages.ts`.

Не покрыто: прогон на устройстве. Гейт был `npm run check:parity` (tsc RN +
svelte-check + домен + i18n), Expo Go не запускался.

## Parity pass по всем экранам (2026-11-21)

Построчный аудит пар web ↔ RN (главная, каталог, рекорды, упражнение, тренировки,
история, билдер, план, live, итоги, программы, прогресс, цикл, AI, тренер,
клиенты, статьи, вход, профиль, настройки). Список расхождений и статусов живёт
в `parity-audit.md`; здесь только что поменялось в коде.

- **Главная.** `HomeCreateCard` для нуля планов; гость без приветствия; чек-лист
  только на холодном старте; карточки прогресса идут за общим периодом
  (`repdraft:progress-period`), дельты период-к-периоду как на вебе.
- **История.** Вход с вкладки «Тренировки», очистка истории с подтверждением,
  «Отмена» в правке сессии, свайп-удаление только в правке.
- **Рекорды.** Пустые состояния (нет рекордов / фильтр пуст), спиннер, фильтр
  строк без веса и повторов.
- **Каталог.** Счётчики зон в режиме «дома» по инвентарю.
- **Билдер.** Отдых суперсета читается у последнего участника группы.
- **План.** `live.noPlan` вместо `builder.loadFail`.
- **Live.** «Далее» не требует закрытых подходов, замена с отмеченными подходами
  спрашивает подтверждение, «Другой вариант» скрыт при отказе домена, пустая
  тренировка даёт пустое состояние.
- **Итоги.** Пустое состояние для удалённой сессии, только упражнения с
  отмеченными подходами, тип подхода только для нерабочих.
- **Цикл.** CTA ведёт в билдер, цель из профиля.
- **AI.** Строки плана кликабельны, очистка поля, подсказка брифа.
- **Прогресс.** Окно периода переживает перезапуск.
- **Профиль.** «Мой тренер» открывает шит приглашения и отключения.

Осталось (см. `parity-audit.md`): plan tune, диктовка в AI, техника-клипы,
история упражнения в live, undo-тосты, свой диапазон дат в истории, фильтры
рекордов, панели помощи, typed confirm удаления аккаунта и `/settings/data`.
