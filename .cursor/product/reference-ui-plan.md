# REPdraft — план UI по референсам

Живой backlog polish-работ по скринам и макетам, которые скидывали в чат (FitnessOnline / TeamSpace / desktop MVP mock / list-row паттерны).

**Не заменяет** [mvp-spec.md](./mvp-spec.md) — scope и P0-flow по-прежнему оттуда.  
**Дополняет** [market-roadmap.md](./market-roadmap.md) — только визуальные и IA-паттерны, не новые продуктовые фичи.

Последнее обновление: **2026-08-18** (ветка `cursor/v0.10.5-summary-more-info`, правки **ещё не закоммичены**).

**Brand assets:** logo system из `REDraft_Logo_System_Figma` скопирован в `src/lib/assets/brand/logo-system/`, tokens — `src/lib/assets/brand/redraft.tokens.json`. Shell использует gradient mark + wordmark **RED**raft.

---

## Источники референсов

| Источник | Что брали | Что не копируем |
|----------|-----------|-----------------|
| **FitnessOnline / fitness-consumer UI** | Секции + View all, chips, row-карточки, preview перед стартом | Dark/neon shell, health overview, 5 табов, калории/watch |
| **Desktop MVP mock (dark REPdraft)** | Широкая колонка, home grid, sidebar, purple accent, productivity-feel | Stats grid на summary, split-view live, greeting/volume/streak |
| **List-row скрины (каталог)** | Квадратное превью слева flush, единая panel, chevron справа | FAB на hub без необходимости |
| **Workouts tabs (Планы / История)** | Centered empty states с иконкой, FAB скрыт на History | «Готовые программы», hero с фото и бейджем «АКТИВНАЯ» |
| **Exercise detail (tabbed)** | Вкладки: Описание / История / Рекорд / Мышцы | Графики, social, AI |
| **iOS / PWA chrome** | Floating tabbar, liquid glass на iPhone, safe-area | Pill-in-pill, лишние nested capsules |

---

## Принципы переноса

1. **Паттерны, не клон** — Repdraft = «план + техника + сессия», не ещё одно fitness-brochure app.
2. **Один primary CTA** на экран / секцию (из mvp-spec).
3. **Mobile-first** — проверять 375 / 390 / 430 + standalone PWA.
4. **Переиспользовать** domain/stores/routes; менять в основном CSS и разметку.
5. **Не тащить из референсов:** analytics dashboards, RPE/RIR, social, AI, nutrition, wearables, готовые программы, progress % / ETA до старта.

---

## Матрица статусов

Статусы: ✅ сделано · 🟡 частично / в работе · ⬜ не начато · 🚫 сознательно не делаем

### Shell / навигация

| Паттерн | Экран | Статус | Где / заметки |
|---------|-------|--------|---------------|
| 3 таба Home / Workouts / Exercises | global | ✅ | `+layout.svelte` |
| Desktop sidebar + мягкий divider под логотипом | desktop | 🟡 | `.shell-sidebar-brand::after` добавлен, нужен visual QA |
| Mobile tabbar: floating pill | mobile | 🟡 | Много итераций; текущий вариант — grid + `@supports (backdrop-filter)` glass |
| Liquid glass **только** на iPhone / backdrop-capable | tabbar | 🟡 | Refactor начат: один pill, без двойной капсулы; **нужен QA на device** |
| Симметричный inset tabbar (top = sides) | tabbar | 🟡 | Убраны лишние боковые padding-слои; пользователь ещё не подтвердил финал |

### Home

| Паттерн | Статус | Заметки |
|---------|--------|---------|
| Hero: continue / start workout | ✅ | `/` |
| Недавние тренировки (список) | ✅ | `live.history` |
| Desktop grid: stats + recent + frequent (как mock) | 🟡 | Базовая сетка есть; **не доведена до референсной плотности** |
| «View all» у секций | ⬜ | Обсуждалось для hub, на Home не сделано |
| Cleanup безымянных сессий в recent | ✅ | `live.refreshHistory()` auto-tombstone |

### Workouts

| Патtern | Статус | Заметки |
|---------|--------|---------|
| Preview: summary panel + список упражнений с превью | ✅ | `/workouts/[planId]` |
| Sticky Start на mobile | ✅ | |
| Edit в header, не второй primary | ✅ | |
| Tabs Планы / История + centered empty | ✅ | `/workouts?tab=history` |
| Progress % / ~1ч до старта | 🚫 | По MVP spec |

### Finish / Summary

| Паттерн | Статус | Заметки |
|---------|--------|---------|
| Duration + exercises + sets counts | ✅ | `/workouts/summary` |
| Preview выполненных упражнений (до 3) | ✅ | `summary.previewExercises` |
| Stats grid / charts на summary | 🚫 | Post-MVP |

### Exercises / каталог

| Паттерн | Статус | Заметки |
|---------|--------|---------|
| Hub: row-карточки зон, превью справа | ✅ | `CatalogZoneCard`, hub variant |
| Target level: спокойнее hub | ✅ | `CatalogTargetCard`, `/catalog/[bodyPart]` |
| 3 уровня иерархии hub → bodyPart → list | ✅ | |
| Единый media slot ~120×120, cap **180×180** | ✅ | `--media-native`, max на wrap |
| Chevron справа по центру строки | ✅ | |
| Hub chips: **Все → Сохранённые → Рекорды → Справочник** | ✅ | `CatalogHubChips.svelte` |
| Hint: сохранённые только локально | ✅ | `/exercises/saved` |
| Усиленный empty state «Сохранённые» | ✅ | `.catalog-empty-state--saved` |
| List-row: square thumb flush left (единая panel) | 🟡 | Базово есть; hub v0.10.5 ушёл в row-cards, сверить с ранним list-panel референсом |
| «View all» в одной строке с заголовком секции | ⬜ | |
| Horizontal target chips на zone-странице | 🟡 | Частично через существующие фильтры |

### Exercise detail `/exercise/[id]`

| Паттерн | Статус | Заметки |
|---------|--------|---------|
| Hero GIF + meta (мышца, оборудование) | ✅ | |
| Техника сообщества (clips) | ✅ | |
| Личный рекорд | ✅ | `PersonalRecordPanel` |
| **Tabbed layout:** Описание / История / Рекорд / Мышцы | ⬜ | **Главный хвост по референсам** |
| Session history на detail (P1 в mvp-spec) | ⬜ | Связано с tab «История» |

### Прочее

| Паттерн | Статус | Заметки |
|---------|--------|---------|
| Широкая desktop-колонка (не 42rem phone-width) | ✅ | Adaptive `--page-content-max` |
| Logo lockup (одна плашка) | ✅ | `Logo.svelte` |
| Skeletons под текущие layout | ✅ | Недавний audit |

---

## Очередь работ (когда вернёмся)

Приоритет = impact на ежедневный UX, не «красота ради красоты».

### P0 — закрыть текущий пакет v0.10.5

1. **Visual QA tabbar на iPhone PWA** — floating glass, симметрия inset, active state без «кривости».
2. **Visual QA sidebar divider** — мягкая линия под брендом.
3. **Commit** накопленных правок в `cursor/v0.10.5-summary-more-info`.

### P1 — главный референсный хвост

4. **`/exercise/[id]` tabbed detail**
   - Tabs: Описание · История · Рекорд · Мышцы (i18n).
   - Описание: GIF, шаги, equipment/target.
   - История: последние сессии из `live` / session repo (read-only).
   - Рекорд: существующий `PersonalRecordPanel`.
   - Мышцы: secondary muscles + body part labels.
   - Один primary CTA (add to draft / builder) вне табов или sticky в header.
   - Оценка: **minor** (`v0.11.0-exercise-detail-tabs`).

### P2 — polish по референсам

5. **Home desktop** — плотнее секции «Недавние» / «Частые» / планы; опционально «View all».
6. **Hub «View all»** — link справа от заголовка вместо отдельной кнопки под поиском (если ещё актуально).
7. **Catalog list-mode на desktop** — опционально, если row-panel на wide screen всё ещё слабее референса.

### P3 — отложено / только по запросу

8. Hero-карточки программ с фото (как consumer fitness apps).
9. Dark-neon aesthetic целиком.
10. Secondary CTA «Перейти к планам» на пустой истории (обсуждалось, не обязательно).

---

## Явные «не делаем» (из референсов)

- Health / steps / calories / watch widgets
- Explore / social / community feed на hub
- Progress % и ETA на workout preview
- Stats grid и charts на summary
- 4+ tabbar items
- Копирование чужого dark-neon shell 1:1

---

## Связанные файлы (текущий пакет)

| Область | Файлы |
|---------|--------|
| Tabbar | `src/routes/+layout.svelte`, `src/routes/layout.css` |
| Summary | `src/routes/workouts/summary/+page.svelte`, `messages.ts` |
| Catalog cards | `CatalogZoneCard.svelte`, `CatalogTargetCard.svelte`, `CatalogExerciseList.svelte` |
| Hub chips | `CatalogHubChips.svelte` |
| Saved hint | `src/routes/exercises/saved/+page.svelte` |
| History cleanup | `src/lib/stores/live.ts` |
| Sidebar divider | `layout.css` (`.shell-sidebar-brand::after`) |

---

## Definition of done (для этого плана)

План считаем закрытым, когда:

- [ ] Tabbar на iPhone PWA выглядит ровно (glass или осознанный fallback без pill-in-pill).
- [ ] `/exercise/[id]` читается как tabbed detail из референса.
- [ ] Каталог 3 уровня визуально согласован (hub / target / list).
- [ ] Summary не ощущается пустым после finish.
- [ ] Home recent не показывает мусорные безымянные сессии.
- [ ] Всё влито в `main` отдельным semver-релизом (patch polish или minor для tabs).

---

## Заметки для агента

Перед следующей сессией по этому документу:

1. Прочитать этот файл + `mvp-spec.md` § Agent workflow.
2. Не расширять scope beyond таблиц выше.
3. Tabbar: prefer **один** floating glass layer; active = tint, не вторая pill.
4. Exercise tabs: reuse existing panels, не плодить новые stores.
5. После ship — обновить статусы в матрице этого файла.
