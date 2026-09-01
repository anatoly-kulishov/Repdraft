# v0.15.0 — Онбординг: план

**Ветка (когда пойдём в код):** `cursor/v0.15.0-onboarding`  
**Тип релиза:** minor — новая пользовательская система (progressive onboarding)  
**North star:** не «ещё экранов», а **time-to-first-completed-set** и **activation rate** (первая завершённая тренировка за 24 ч)

Сверка с [`GOAL.md`](../../GOAL.md): онбординг ускоряет священный цикл, не отвлекает от него.  
Сценарии QA: [`.cursor/product/user-scenarios.md`](user-scenarios.md) (короткие шаги, sync с `static/content/`).

---

## 1. Зачем v0.15.0

Сейчас Repdraft полагается на **контекстные empty states** и разрозненные hints. Это работает для терпеливых пользователей, но:

- новичок не понимает **полный путь** «создать → превью → live → финиш → история»;
- guest не видит **зачем аккаунт**, пока не дойдёт до summary;
- сложные экраны (builder superset, live alt picker, rest timer) **не объясняются** в момент первого контакта;
- нет единого **«прогресса знакомства»** — hints dismiss'ятся по отдельности, без связности;
- часть copy заготовлена (`home.records*`, `articles.homeTeaserTitle`), но **не подключена**.

**Цель v0.15.0:** сквозной, но **не блокирующий** онбординг на каждом экране — пользователь доходит до первого записанного подхода **без мануала** и **без 7-screen wizard**.

---

## 2. Метрики успеха

| Метрика | Определение | Цель (ориентир) |
|---------|-------------|-----------------|
| **TTV** (time-to-value) | От первого открытия до **завершения 1-го подхода** в live | < 3 мин (guest с sample plan), < 5 мин (создал свой план) |
| **Activation D0** | Завершена хотя бы 1 сессия (finish → summary) в первые 24 ч | ≥ 40% новых install/open |
| **Onboarding completion** | Пройден checklist «Знакомство» (4 шага, см. §5) | ≥ 60% активировавшихся |
| **Guest → account** | Guest с ≥1 сессией создал аккаунт в 7 дней | ≥ 25% |
| **PWA install** (mobile) | Install hint → add to home (если измеримо) | baseline + uplift после contextual prompt |

**Instrumenting (минимум для v0.15.0):** localStorage/onboarding store events + dev-only debug panel; prod analytics — только если уже есть privacy-safe pipeline (не блокер релиза).

---

## 3. Принципы Repdraft (vs индустрия)

### Делаем

1. **Value first, account later** — guest train с первого экрана (уже так; усилить sample path).
2. **Progressive disclosure** — coachmark/hint **в момент действия**, не upfront tour на 10 слайдов.
3. **One primary CTA** — онбординг не добавляет вторую primary на экран.
4. **Skip everywhere** — любой overlay/hint закрывается и не возвращается (persist dismiss).
5. **Empty state = onboarding** — каждый «нулевой» экран объясняет следующий шаг + одна кнопка.
6. **Celebrate micro-wins** — первый сохранённый план, первый подход, первый finish (лёгкий toast/banner, не confetti circus).
7. **RU-first copy** — коротко, без LLM-воды, без em-dash.

### Не делаем (anti-patterns)

- Mandatory signup до первого подхода (ошибка Hevy).
- 5+ экранов intake «цель / уровень / рост / вес» до value (killer activation).
- Paywall / feature gate в онбординге.
- Blocking full-screen tutorial без skip.
- Feature dump на Home («вот 12 возможностей»).
- Push permission до первой завершённой тренировки.
- Social / gamification / streak pressure в первую неделю (backlog после онбординга).

---

## 4. Конкуренты и best practices

### Сводка по категории

| Продукт | Онбординг | Сильное | Слабое | Урок для Repdraft |
|---------|-----------|---------|--------|-------------------|
| **Hevy** | ~10 шагов, signup до core | Библиотека, social proof | Signup wall, перегруз live UI | Guest-first + contextual hints в live |
| **Strong** | Минимальный, notebook-first | Быстрый empty workout | Слабая техника, устаревший UX | Сохранить «think less» — один CTA |
| **JEFIT** | Длинный quiz + program pick | Готовые программы | Долго до первого подхода | Опциональный «стартовый шаблон», не quiz |
| **Fitbod** | AI intake, paywall рано | Персонализация | Дорого, не наш wedge | Не копировать intake |
| **Boostcamp** | Program-first | PPL из коробки | Не logger-first | Шаблон «Первая тренировка» как shortcut |
| **MuscleWiki** | Technique-first | Обучение | Слабый log | Связать catalog → plan → live в одном story |

### Industry benchmarks (2025–2026)

- **90 с – 5 мин** до первого meaningful action ([Lifecycle Architect](https://lifecyclearchitect.com/guides/onboarding-optimization-for-fitness-apps/)).
- **3–5 intake screens max** если intake вообще нужен; остальное — после activation.
- **Activation = completed workout**, не signup и не profile 100%.
- **Empty states** — главный silent drop-off; каждый zero-data экран = CTA ([Smashing Magazine](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)).
- **Coachmarks** — one at a time, trigger on context ([Digia progressive disclosure](https://www.digia.tech/post/progressive-disclosure-mobile-ux)).
- **Permission prompts** — после value moment (post-workout для notifications; post-2nd visit для PWA если не сработало раньше).

### Позиционирование Repdraft

«Тихий логгер с техникой» — онбординг продаёт **скорость записи подхода** и **спокойствие**, не community и не AI.

---

## 5. Архитектура онбординга

### 5.1 Состояние (новый слой)

**Файлы (план):**

- `src/lib/domain/onboarding.ts` — типы шагов, predicates, pure helpers
- `src/lib/stores/onboarding.ts` — persist `repdraft:onboarding` в localStorage
- `src/lib/components/onboarding/` — `Coachmark.svelte`, `OnboardingChecklist.svelte`, `FirstWinToast.svelte`

**Модель прогресса (checklist, не wizard):**

```text
[ ] Увидел Home и понял первый шаг
[ ] Создал или выбрал план (вкл. sample)
[ ] Открыл preview / начал live
[ ] Записал первый подход
[ ] Завершил тренировку (finish → summary)
```

Checklist **не блокирует** навигацию; показывается compact chip/card на Home до completion или dismiss.

**Dismiss keys (миграция существующих):**

| Key | Сейчас | v0.15.0 |
|-----|--------|---------|
| `repdraft:install-hint-dismissed` | PWA | оставить |
| `repdraft:guest-sync-hint-dismissed` | summary | привязать к «шаг 5 checklist» |
| `repdraft:onboarding` | — | `{ checklist, coachmarks: Record<id, dismissed>, activatedAt?, samplePlanUsed? }` |

### 5.2 Паттерны UI

| Паттерн | Когда | Компонент |
|---------|-------|-----------|
| **Hero empty state** | Zero data на route | `EmptyState` + иллюстрация/icon |
| **Inline banner** | Мягкий nudge, не overlay | `.panel` secondary, ghost dismiss |
| **Coachmark** | Первый раз на элементе | spotlight + 1 строка + «Понятно» |
| **Bottom sheet tip** | Сложная концепция (superset, alt) | `BottomSheet`, один раз |
| **Checklist card** | Home, до activation | collapsible, 4–5 пунктов |
| **Micro-celebration** | Milestone | toast 2s, undo не нужен |

**Правило:** на экране максимум **1 onboarding overlay** одновременно. Приоритет: sacred loop > account > PWA > второстепенное.

### 5.3 Два пути активации

| Путь | Для кого | Flow |
|------|----------|------|
| **Fast path (sample)** | «Хочу попробовать сейчас» | Home → «Попробовать демо-тренировку» → preview → live → finish (< 3 мин) |
| **Builder path** | «Хочу свой план» | Home → builder → picker → save → preview → live → finish |

Оба равноценны в checklist. Sample plan — **локальный шаблон**, не cloud; 3–4 упражнения, понятные новичку ( присед / жим / тяга или bodyweight вариант ).

---

## 6. Карта touchpoints: «везде»

### 6.1 `/` Home

**Сегменты:**

| Сегмент | Сейчас | v0.15.0 |
|---------|--------|---------|
| Guest, 0 plans | Guest hero + create | + secondary **«Попробовать демо»**; checklist card |
| Guest, has plan, 0 sessions | Welcome / first workout hint | Coachmark на **Start** → preview |
| Signed-in, 0 plans | Create row | EmptyState quality pass + «С чего начать» link → `/articles` |
| Has active session | Continue CTA | Без онбординга (не мешать) |
| Returning, activated | Normal home | Checklist hidden; optional «Справка» в profile |

**Copy:** задействовать `articles.homeTeaserTitle` («С чего начать») — card/teaser под hero.

**PWA hint:** показывать **после** первого finish или на 2-й визит, не на first paint (сейчас mounted globally — сдвинуть trigger).

---

### 6.2 `/workouts` (Plans + History)

**Plans tab, empty:**

- EmptyState: «Сохранённые тренировки появятся здесь» + Create + **Import backup** (есть) + link «или попробуйте демо».
- Coachmark на tabbar **Workouts** при первом визите с планом: «Ваши планы здесь».

**History tab, empty:**

- EmptyState: «После первой тренировки здесь будет история» + CTA Start (если есть plan) / Create.
- Preview mock row (disabled): «Пример: Силовая · 42 мин · 12 подходов» — show-don't-tell.

**Search empty:** оставить; добавить «Сбросить фильтр» если ещё нет.

**Plan card actions:** first time — coachmark на **Preview** (не Start сразу): «Сначала посмотрите план».

---

### 6.3 `/workouts/[planId]` Preview

**Первый визит:**

- Coachmark на **Start**: «Начните, когда готовы. Подходы сохранятся автоматически».
- Inline hint про exercise order / superset icon (если в плане есть superset).

**Edge:** plan deleted → EmptyState уже есть; добавить «Создать новую».

---

### 6.4 `/builder` и `/builder?new`

**Empty builder:**

- EmptyState + sticky Add (есть).
- First visit sheet (bottom): «Как собрать тренировку» — 3 bullet: имя → упражнения → подходы×повторы → сохранить. Skip.

**≥2 exercises, first superset opportunity:**

- Существующий `builder.groupHint` → upgrade to coachmark на checkbox select + group bar.

**First save success:**

- Toast «План сохранён» + checklist tick + optional «Смотреть preview».

**Mobile duplicate Add:** уже fixed — проверить в QA checklist.

---

### 6.5 `/exercises`, `/catalog/*`, picker mode

**Hub `/exercises`:**

- First visit: coachmark на search «1300+ упражнений, RU/EN».
- Chip **Saved** / **Articles** — one-time tooltip если не открывали.

**Picker `?from=/builder`:**

- Sticky context bar (если нет): «Выберите упражнения → вернитесь в конструктор».
- First pick: toast «Добавлено в план» + undo.

**Category empty / saved empty:** EmptyState pass — bookmark hint на `/exercise/[id]`.

**Filters conflict:** уже есть; добавить «?" icon → 1 строка про фильтры.

---

### 6.6 `/exercise/[id]`

**First visit (any exercise):**

- Coachmark: tabs **About / History / Technique** (если clips есть).
- Saved toggle: «В избранное для быстрого доступа».

**History tab empty:** `exercise.historyEmpty` → + «История появится после тренировок с этим упражнением».

**Technique clips empty:** hint «Запишите GIF после подхода» (link live flow) — только если user activated.

---

### 6.7 `/live/[planId]` — **самый важный**

Приоритет UX онбординга #1.

| Элемент | First-time coachmark |
|---------|---------------------|
| Weight × reps inputs | «Введите вес и повторы» |
| Complete set button | «Отметьте подход выполненным» |
| Rest timer ring | «Таймер отдыха запустится автоматически» (если pref on) |
| Next exercise | «Переход к следующему упражнению» |
| Exercise nav chips | «Переключайтесь между упражнениями» |
| Last time chip | «Подставить прошлый результат» (после 2-й сессии) |
| Alt picker (OR group) | Bottom sheet explain один раз |
| Bodyweight hint | уже есть в LiveSetPanel |
| Finish | «Завершите, когда закончите тренировку» — **до** first finish only |

**Правило зала:** coachmarks **до** начала первого подхода или между подходами — never overlay keyboard/focus during typing.

**Simple mode (optional v0.15.0 P1):** скрыть secondary actions first session (Reorder, notes) — только если не ломает power users; default off, flag in onboarding store.

---

### 6.8 `/workouts/summary`

**First finish ever:**

- Celebration panel: «Первая тренировка сохранена» + stats + checklist complete.
- Guest: **guest sync hint** (есть) — переписать copy: «Сохраните в аккаунте, чтобы не потерять прогресс» + timing после celebration (не конкурировать с Done).

**Done CTA:** один primary (есть).

---

### 6.9 `/workouts/history/[id]`

**First history open:**

- Inline «Здесь детали каждой тренировки» (banner once).

**Edit mode:** coachmark на edit/delete если появится в retest gaps.

---

### 6.10 `/records`

**Empty:**

- EmptyState + guest sign-in link (есть).
- После activation: «Рекорды обновляются из live и истории».

**First PR:**

- Toast micro-win.

---

### 6.11 `/auth` Profile

**Guest:**

- Не onboarding wall — **Interface prefs** (lang/theme/backup) как «можно настроить до входа» (есть).
- Coachmark: «Войдите, когда захотите сохранить в облаке».

**First login migrate:**

- Toast `auth.migrateLocalHint` (есть) — добавить checklist tick «Данные перенесены».

**Help entry (new):**

- Link «Как пользоваться» → `/articles` hub или anchor checklist replay (без сброса dismiss).

---

### 6.12 `/articles` — Getting started

- Поднять hub: «С чего начать» — **первая** статья / pinned card.
- Минимум 3 короткие статьи (или sections):
  1. Первая тренировка за 3 минуты
  2. Как собрать план
  3. Guest vs аккаунт и backup
- Home teaser ведёт сюда.

---

### 6.13 Global: nav, PWA, toasts

**Tabbar / sidebar:**

- First session: optional pulse on **Workouts** tab after plan created (subtle, not purple dot — user hated crooked dot).

**PWA `PwaInstallHint`:**

- Trigger: `activatedAt` set OR `visitCount >= 2`, not dismissed.
- Position: не перекрывает Home primary CTA.

**Draft dock:**

- First builder exit with draft: explain dock «Черновик сохранён».

**Cloud sync banner:**

- После login только; не в первый guest visit.

---

## 7. Guest → Account journey (сквозной)

```text
Open app (guest)
  → Home hero: train without account
  → [optional] demo workout → live → finish
  → Summary: celebration → guest sync hint
  → /auth: sign up
  → migrate toast + cloud sync banner on /workouts
  → Checklist: «Прогресс в аккаунте»
```

**Timing:** sync hint **не** на первом экране; **не** блокирует Done на summary.

**TASK_SPEC §4.2** уже описывает intent — v0.15.0 formalizes UX.

---

## 8. i18n и техдолг copy

Подключить или удалить:

| Key | Действие |
|-----|----------|
| `articles.homeTeaserTitle` | Home teaser card |
| `home.emptyTitle`, `home.emptyDesc` | Unified empty copy или delete |
| `home.guestTitle`, `home.guestLead`, `home.createLead` | Merge с текущим guest hero |
| `home.records*` | Records teaser on Home **или** delete if out of scope |
| `lang.hint` | Auth language coachmark |

Все onboarding strings — `onboarding.*` namespace в `messages.ts`.

---

## 9. Фазы реализации v0.15.0

### Phase A — Foundation (week 1)

- [x] `domain/onboarding.ts` + store + persist schema
- [x] `Coachmark.svelte` (spotlight, dismiss, a11y focus trap light)
- [x] `OnboardingChecklist.svelte` on Home
- [x] Dev flag `?onboarding=reset` для QA
- [x] Unit tests: predicates, checklist progression

### Phase B — Activation paths (week 1–2)

- [x] Sample/demo plan seed + «Попробовать демо» CTA on Home
- [x] First-finish celebration on summary
- [x] Guest sync hint timing/copy refactor
- [x] PWA hint trigger deferral

### Phase C — Screen coachmarks (week 2–3)

- [x] Live session coachmarks (priority order §6.7)
- [x] Preview Start coachmark
- [x] Builder first-save + superset sheet
- [x] Workouts empty states upgrade (mock history row)
- [x] Exercise detail tabs coachmark

### Phase D — Content & polish (week 3)

- [x] Articles «С чего начать» + Home teaser
- [x] `/auth` help link + replay checklist (read-only)
- [x] i18n RU/EN full pass
- [x] Wire unused keys or remove

### Phase E — QA & ship

- [x] Update `user-scenarios.md` onboarding + III.1.7 checklist
- [x] E2E: `onboarding-guest-demo.spec.ts` (demo → live → finish)
- [x] E2E: coachmark dismiss does not re-show
- [x] `npm run check` + full e2e
- [ ] Usability test: 3 новичка без инструкций (ux-research §171 tasks)

---

## 10. QA сценарии (acceptance)

| # | Сценарий | Expected |
|---|----------|----------|
| 1 | Fresh guest, first open | Home checklist visible; primary Create; secondary Demo |
| 2 | Demo path | Preview → live → 1 set → finish < 5 min |
| 3 | Builder path | Empty hints → add 2 ex → save → checklist tick |
| 4 | Live first time | Coachmarks skippable; no overlap with keyboard |
| 5 | Second visit | No repeated coachmarks; PWA may appear |
| 6 | Guest finish | Celebration then guest hint; Done works |
| 7 | Login after guest | Migrate toast; data visible |
| 8 | Skip all onboarding | App fully usable; no blocked screens |
| 9 | RU/EN toggle | All onboarding strings switch |
| 10 | a11y | Coachmark focusable dismiss; `aria-live` on celebrations |

---

## 11. Риски и mitigations

| Рisk | Mitigation |
|------|------------|
| Onboarding overload | One overlay max; sacred loop screens minimal |
| Conflicts with GOAL «no feature count» | Ship checklist + live coachmarks first; defer articles |
| Sample plan maintenance | Static JSON in `static/data/sample-plan.json` |
| Coachmark bugs on resize | Test mobile keyboard open/close |
| Returning user sees junk | Strict dismiss persist; checklist hidden after activation |

---

## 12. Out of scope v0.15.0

- Push notifications onboarding
- Email lifecycle (D1/D7 nudges)
- AI program generation
- Streak / gamification
- Video tutorial host
- Full analytics dashboard
- Native app onboarding

→ Backlog **v0.16+** после замера activation.

---

## 13. Связанные файлы (текущая база)

| Область | Файлы |
|---------|-------|
| Home states | `src/routes/+page.svelte` |
| Empty states | `src/lib/components/EmptyState.svelte` |
| PWA | `src/lib/components/PwaInstallHint.svelte`, `domain/pwaInstall.ts` |
| Guest sync | `src/routes/workouts/summary/+page.svelte` |
| Migrate | `src/lib/stores/auth.ts`, `storage/dataAccess.ts` |
| Builder hint | `src/routes/builder/+page.svelte` |
| Live hints | `LiveSetPanel.svelte`, `LiveAltPicker.svelte` |
| i18n | `src/lib/i18n/messages.ts` |
| Product QA | `.cursor/product/user-scenarios.md` |

---

## 14. Definition of Done v0.15.0

1. Новый пользователь **без инструкций** проходит demo или builder path до finish (usability test 3/3).
2. Checklist + coachmarks на **всех** routes из §6 (минимум inline empty upgrade где coachmark не нужен).
3. Guest → account journey согласован по timing.
4. Нет регрессии sacred loop (e2e green).
5. `package.json` → `0.15.0`, release tag `v0.15.0`.
