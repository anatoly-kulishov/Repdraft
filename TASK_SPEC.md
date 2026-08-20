# 🚀 TECHNICAL TASK (ТЗ): Repdraft MVP — UI/UX Optimization & Native-Ready Architecture

**Стек репозитория:** SvelteKit + TypeScript + Tailwind 4 + Svelte stores + `localStorage` / local repos (+ опциональный Supabase).  
**Не использовать:** Next.js, React Query / SWR, Zustand, `vaul`, React Context. Маппить требования на существующие слои (`domain` → `stores` → `storage` → `routes` / `components`).  
**Северная звезда:** [`GOAL.md`](GOAL.md) · исследование: [`.cursor/product/ux-research-mvp-direction.md`](.cursor/product/ux-research-mvp-direction.md).

## 🎯 ГЛАВНАЯ МАНТРА ПРОЕКТА
> **«Максимальный комфорт UI/UX и безупречный базовый опыт в MVP — превыше любых новых фич. Каждое решение оценивается через призму: ускоряет и упрощает ли это работу атлета в зале?»**

---

## 🛠 ЭТАП 1. Offline-First, Caching & Instant Performance

### Task 1.1: Cache-First Data Management & Optimistic UI
* **Цель:** Исключить блокирующие экраны загрузки («Загрузка…») при переключении между страницами.
* **Требования к реализации:**
  * **Не** ставить React Query / SWR. Держать данные в существующих **Svelte stores** (`$lib/stores/*`) и репозиториях (`$lib/storage/*`).
  * При гидрации читать из `localStorage` / local repos сразу; UI показывать из локального кэша (скелетоны / `PageSkeleton` только на первом cold start, не на каждом переходе).
  * Ориентиры «свежести» при фоновой синхронизации с Supabase (если облако доступно): считать локальные данные актуальными ~5 минут; не выкидывать локальный кэш раньше ~24 часов без нужды.
  * Операции записи подходов (Set Done / Update / Delete): **optimistic** - сначала `live.patchSet` / store update + `persistActive` в localStorage, UI за 0ms; сеть/Supabase только фоном через существующий sync-путь, без блокирующего спиннера.

### Task 1.2: PWA & Offline Support
* **Цель:** Полная автономность приложения в спортзалах с плохим покрытием сети.
* **Требования к реализации:**
  * Опираться на уже существующие **SvelteKit PWA**: `src/service-worker.ts`, `static/manifest.webmanifest` (не Next.js PWA-плагины).
  * Стратегия кэширования для статических медиа (картинки / GIF техники): `CacheFirst` в service worker.
  * Стратегия для JSON каталога / API-подобных запросов: `StaleWhileRevalidate`.
  * При отсутствии сети: мутации сессии уже пишутся локально; при появлении сети (`navigator.onLine` / `online` event) догонять облачный sync через существующие repos (очередь неотправленного - расширять local→cloud path, без React Query mutation queue).

---

## 🏋️ ЭТАП 2. Революция ввода подходов (Workout Session UX)

### Task 2.1: Компонент ввода подходов (`LiveSetPanel.svelte` / set row)
* **Цель:** Избавить пользователя от лишней нативной клавиатуры при типичных правках веса/повторов.
* **Требования к реализации:**
  * Поля веса и повторений - крупные, touch-зона **≥ 48×48px** (токены в `layout.css` / Tailwind `min-h-[48px] min-w-[48px]`).
  * Быстрые кнопки-пресеты (Quick Adjust Pills) на текущем подходе:
    * Вес: `+1`, `+2.5`, `+5`, `+10` (и `-` аналогично) через domain-хелперы (`nudgeWeightKg` / `nudgeReps` в `$lib/domain/inputLimits.ts`).
    * Повторения: `+1`, `-1`.
  * Клики по пресетам обновляют store мгновенно (`live.patchSet`) без фокуса на `input` / без вызова клавиатуры.

### Task 2.2: Автозаполнение & кнопка «Готово»
* **Цель:** Подтверждение подхода в 1 тап.
* **Требования к реализации:**
  * При `live.startFromPlan` открытые подходы префиллятся из `lastPerformance` / `live.lastFor(exerciseId)` (история в store).
  * Если данных нет - вес пустой; reps можно оставить из prescription (`targetReps`) или пустыми по UX-решению, согласованному с Live.
  * Кнопка «Готово» визуально крупная (**≥ 48×48px**; минимум из ТЗ был 40px - у нас строже).
  * При нажатии:
    1. Подход `completed: true` (цвет строки/фона).
    2. Короткий haptic: `navigator.vibrate?.(50)` (no-op на iOS).
    3. Rest timer через уже существующий `live` store (`restUntil` + UI на live-странице).
    4. Фокус / выбранное упражнение → следующий подход (`nextFocusAfterSetComplete`).

### Task 2.3: Глобальный виджет таймера отдыха (live rest bar)
* **Цель:** Наглядный контроль отдыха без переключения окон.
* **Требования к реализации:**
  * **Не** Zustand / React Context. Состояние уже в **`$lib/stores/live`**: `restUntil`, `skipRest`, `adjustRestSeconds`.
  * Виджет в нижней зоне live (sticky / floating bar), не перекрывает primary CTA.
  * Кнопки коррекции: минимум `+15` / `−15` (уже есть) или усилить до `+30` / `−30` + «Пропустить» (`live.skipRest`).
  * По истечении: существующие `vibrateRestDone` / `playRestDoneChime` из `$lib/domain/prefs` (prefs store).

---

## 🔍 ЭТАП 3. Умный каталог и поиск упражнений (Smart Exercises)

### Task 3.1: Cold Start & разметка каталога
* **Цель:** Релевантная выдача до глобальной аналитики.
* **Требования к реализации:**
  * Расширить модель упражнения в domain / `static/data` (через `build:data`): поле `globalPopularity: number` (1–100).
  * ТОП-25 базовых движений: `80–100` (жим лёжа, присед, становая, подтягивания, жим стоя, махи, бицепс, брусья и т.д.).
  * Изоляции / редкие: `10–40`.

### Task 3.2: Гибридный алгоритм ранжирования (Hybrid Scoring)
* **Цель:** Сортировка по глобальному весу + личному поведению.
* **Требования к реализации:**
  * В localStorage (отдельный ключ / маленький repo в `$lib/storage`) объект `userExerciseStats`:
    `{ [exerciseId: string]: { count: number, lastUsedAt: number } }`.
  * Чистая утилита в `$lib/domain` (без DOM):
    ```typescript
    const getScore = (ex: { globalPopularity: number }, stats?: UserStat) => {
      const global = ex.globalPopularity * 0.3;
      const count = (stats?.count || 0) * 10;
      const isRecent = stats?.lastUsedAt && (Date.now() - stats.lastUsedAt < 14 * 86400000);
      const recency = isRecent ? 20 : 0;
      return global + count + recency;
    };
    ```
  * Три секции в каталоге / picker:
    1. **«Часто используемые»**
    2. **«Популярные в зале»** (`globalPopularity`)
    3. **«Все упражнения»** (`getScore`)

### Task 3.3: Фильтрация в 1 тап и Fuzzy Search
* **Цель:** Без глубокой вложенности при поиске.
* **Требования к реализации:**
  * Горизонтальные чипсы (группы мышц + оборудование) - расширять существующий catalog UI / `catalogUi` store, не новый фреймворк.
  * Клиентский поиск: **существующая** domain-фильтрация / fuzzy в `$lib/domain` (не обязательно `fuse.js` - новая зависимость только по явному запросу). Debounce ввода ≤ 150ms.

### Task 3.4: Быстрое добавление (Quick Add)
* **Цель:** Добавить упражнение в черновик/план без обязательного захода на detail.
* **Требования к реализации:**
  * Кнопка `+` в карточке списка каталога / picker.
  * `draft` / `plans` store: сразу append; toast через `$lib/stores/toasts` («Упражнение добавлено»).

---

## 📱 ЭТАП 4. Mobile-First Эргономика & Low-Barrier Entry

### Task 4.1: Thumb-Zone & Bottom Sheet UX
* **Цель:** Одна рука в зале.
* **Требования к реализации:**
  * Ключевые CTA («Старт», «Готово» / Next, «Добавить») - нижняя треть / sticky (`pb-mobile-actions`, `live-sticky-actions` в `layout.css`).
  * Модалки на mobile → **bottom sheet** на CSS / существующие overlay-паттерны Svelte. **Не** ставить `vaul` без явной просьбы.

### Task 4.2: Гостевой режим (Guest Mode / Low-Barrier Entry)
* **Цель:** Тренировка за 1 тап без обязательной регистрации.
* **Требования к реализации:**
  * Не редиректить жёстко с `/` на `/auth` (гость уже опирается на local repos).
  * Неавторизованный = локальный профиль; планы/сессии в localStorage через `$lib/storage`.
  * Мягкий баннер «войти» после 1-й завершённой тренировки; при логине - существующая миграция локальных данных в аккаунт (`auth` / migrate hint).

---

## 📐 ЧЕК-ЛИСТ ДЛЯ ПРОВЕРКИ (DEFINITION OF DONE)
* [ ] Все элементы взаимодействия имеют размер touch-зоны ≥ 48×48px.
* [ ] Приложение корректно работает и сохраняет данные в режиме «В самолёте» (Offline Mode).
* [ ] Ни одно действие во время тренировки не требует более 2 тапов.
* [ ] Экраны не показывают блокирующие спиннеры загрузки при повторном посещении (скелетон/кэш stores).
* [ ] Выдача упражнений мгновенно предлагает подтягивания/жимы/приседы, а не второстепенную изоляцию.
* [ ] Модалки на mobile открываются как Bottom Sheet снизу вверх (без `vaul`, пока не попросили).
* [ ] Нет новых React/Next зависимостей; проверка: `npm run check`.
