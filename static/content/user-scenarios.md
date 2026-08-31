# Repdraft — пользовательские сценарии

**В приложении (QA):** [`/scenarios`](/scenarios) — удобно на телефоне до публичного запуска.  
**Профиль:** `/auth` → «Сценарии».

Живой документ: пошаговые user flows по текущему состоянию приложения (SvelteKit PWA).

**Северная звезда:** [`GOAL.md`](../../GOAL.md) — священный цикл тренировки.  
**Спека экранов:** [`mvp-spec.md`](mvp-spec.md).  
**UX guardrails:** [`ux-research-mvp-direction.md`](ux-research-mvp-direction.md).

**Главная метрика:** время от взгляда на телефон → записанный подход.

---

## 1. Роли и контексты использования

| Роль | Контекст | Главная задача |
|------|----------|----------------|
| **Новичок** | Первый визит, нет планов | Создать первую тренировку и понять, что делать дальше |
| **Регулярный атлет** | Есть 1–5 планов, знает рутину | Быстро начать «следующую» тренировку |
| **Атлет в зале** | Активная сессия, одна рука, шум | Записать подход без лишних тапов |
| **Планировщик** | Дома / не в зале | Собрать или отредактировать план |
| **Исследователь каталога** | Ищет упражнение | Найти, сохранить, добавить в план |
| **Гость** | Без аккаунта | Тренироваться локально, опционально синхронизировать позже |

---

## 2. Информационная архитектура

### 2.1. Основная навигация (mobile tabbar)

| Вкладка | Маршруты | Назначение |
|---------|----------|------------|
| **Home** | `/` | Быстрый старт, активная сессия, недавние |
| **Workouts** | `/workouts`, `/workouts/[id]`, `/live/[id]`, `/workouts/summary`, `/workouts/history/[id]` | Планы, история, превью, live |
| **Exercises** | `/exercises`, `/catalog/*`, `/exercise/[id]`, `/exercises/saved`, `/records` | Каталог, детали, закладки, рекорды |

### 2.2. Вторичная навигация

| Раздел | Маршрут | Назначение |
|--------|---------|------------|
| Profile / Settings | `/auth` | Вход, язык, тема, экспорт, удаление аккаунта |
| Builder | `/builder`, `/builder/[planId]` | Редактор плана (часто immersive, без tabbar) |
| Privacy | `/privacy` | Политика |
| Articles | `/articles`, `/articles/[slug]` | Контент (низкий приоритет MVP) |

### 2.3. Глобальные UI-паттерны

- **Draft Dock** - плавающая плашка «К редактору · N», когда в черновике есть упражнения
- **FAB** - создание плана на `/workouts`, контекстные действия в каталоге
- **Sticky CTA** - одна primary-кнопка внизу на preview, exercise detail, builder save
- **Bottom sheets** - подтверждения (finish, discard, skip, backup import, clear history) вместо blocking modal; стили глобальные (`screen-misc.css`), работают на `/auth` без `live.css`
- **Toasts** - краткий feedback (success/info/error) и **undo** с таймером; крестик закрытия по центру по высоте строки
- **Undo toasts** - отмена удаления (закладки, планы, сессии, рекорды, builder draft, **очистка всей истории**)

---

## 3. Священный цикл (P0)

```text
Открыть приложение
      ↓
Выбрать тренировку
      ↓
Посмотреть, что сегодня делать
      ↓
Начать
      ↓
Выполнить подход
      ↓
Записать вес × повторения
      ↓
Следующее упражнение
      ↓
Закончить
      ↓
Увидеть сохранённый результат
```

### 3.1. Быстрый старт с Home (есть планы)

| Шаг | Действие пользователя | Экран / результат |
|-----|----------------------|-------------------|
| 1 | Открывает приложение (PWA / браузер) | Boot splash → Home |
| 2 | Видит приветствие + название **следующего плана** (ротация / pin) | Hero-блок; mobile CTA — иконка **Play** (текст на desktop) |
| 3 | Тап по hero или CTA | `/workouts/[planId]` — **превью плана** |
| 4 | Просматривает список упражнений, sets×reps, мышцы | Может открыть technique sheet по упражнению |
| 5 | Тап **«Начать»** | `/live/[planId]` — **активная тренировка** |
| 6 | Видит текущее упражнение, таблицу подходов | Autosave; таймер отдыха после завершения подхода |
| 7 | Вводит **вес** и **повторы** (или тап по chip «прошлый раз») | Prefill last-time |
| 8 | Тап **«Готово»** на подходе | Подход помечен ✓, запускается rest timer |
| 9 | (Опционально) ждёт rest / skip rest | Ring + звук (если включён в профиле) |
| 10 | Тап **«Далее»** | Следующий подход или упражнение |
| 11 | Повторяет шаги 6–10 для всех упражнений | LiveExerciseNav: горизонтальные chips (все с фоном, active — accent) |
| 12 | Тап **«Закончить»** | Bottom sheet: подтверждение |
| 13 | Подтверждает finish | `/workouts/summary?id=…` |
| 14 | Видит длительность, объём, список выполненных подходов | Primary CTA «Готово» |
| 15 | Тап «Готово» | `/workouts?tab=history` или Home |
| 16 | Сессия в истории | Можно открыть `/workouts/history/[id]` |

**UX-цель:** шаги 5–10 — секунды на подход, без «где я?» и без blocking loaders.

### 3.2. Продолжение прерванной тренировки

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Открывает приложение при незавершённой сессии | Home: карточка **«Тренировка идёт»** + прогресс (упражн./подходы) |
| 2 | Тап по карточке **или** по иконке Play на карточке | `/live/[planId]` — восстановление из localStorage |
| 3 | Продолжает с текущего упражнения/подхода | Все данные сохранены offline |

**Доп. сигнал:** вкладка Workouts в tabbar получает `aria-label` «… активная тренировка» (без badge-точки). Основной вход — карточка на Home.

---

## 4. Управление планами

### 4.1. Создание нового плана (с нуля)

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Home (нет планов) **или** Workouts → FAB «+» | `/builder?new` → сброс черновика |
| 2 | Вводит название плана | Draft store (localStorage); mobile — поле в sticky chrome |
| 3 | Тап **«+ Добавить»** | Mobile: только sticky-бар внизу → `/exercises?from=/builder`. Desktop: FAB / empty CTA / ссылка под списком |
| 4 | Ищет / выбирает зону / фильтрует | `/catalog/[zone]`, `/catalog/all?q=…` |
| 5 | Тап **+** на карточке упражнения | Toast «Добавлено в план»; Draft Dock появляется |
| 6 | (Опционально) Draft Dock → «К редактору» | `/builder` |
| 7 | Настраивает sets, reps, rest на каждой строке | WorkoutExerciseRow |
| 8 | (Опционально) 2+ упражнения, но <2 выбрано | Hint «Галочки слева…» под toolbar группировки |
| 9 | (Опционально) Выделяет 2+ упражнения → Superset / OR-группа | Toolbar в chrome (mobile) / section-head (desktop): «Выбрано · N» + 2 кнопки |
| 10 | (Опционально) Drag reorder | Порядок упражнений |
| 11 | (Опционально) Swipe delete / remove на строке | Undo toast → упражнение на прежнем index |
| 12 | Тап **«Сохранить»** | План в `plans` store → `/workouts` или preview |
| 13 | Toast подтверждения | План доступен для старта |

### 4.2. Редактирование существующего плана

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | `/workouts` → тап по плану **или** preview → иконка карандаша | `/builder/[planId]` |
| 2 | Черновик гидрируется из плана | Те же операции, что в §4.1 |
| 3 | Сохранить | Обновление плана; unchanged detection блокирует лишний save |

### 4.3. Удаление / дублирование / порядок планов

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | `/workouts` (вкладка «Мои») | Список планов; «Следующая» — первая |
| 2 | Swipe влево на плане | «Сделать следующей» / «Удалить» |
| 3 | Удаление | Undo toast → восстановление плана |
| 4 | Reorder mode (если >1 плана, без поиска) | Drag handles → `planOrder` |
| 5 | Копирование плана | Дубликат с новым id |
| 6 | Pin «Следующая» | `homeNextPlan` — приоритет на Home |

---

## 5. Каталог и упражнения

### 5.1. Поиск упражнения

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Exercises → поиск на hub | `/catalog/all?q=…` |
| 2 | Или chip зоны (Грудь, Ноги…) | `/catalog/[zone]?target=…` |
| 3 | Фильтр по снаряду (bottom sheet) | Сужение списка |
| 4 | Тап по карточке | `/exercise/[id]?from=…` |

### 5.2. Карточка упражнения (detail)

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Открывает detail | Иллюстрация, chips (зона, снаряд, мышца) |
| 2 | Переключает табы | **Техника** / **История** / **Рекорд** / **Мышцы** (по умолчанию «Техника») |
| 3 | Тап bookmark | Сохранить / убрать (undo при удалении) |
| 4 | Sticky **«+ Добавить в план»** | В draft или toast «уже в плане» |
| 5 | (Опционально) Technique clips | Запись/просмотр GIF техники |
| 6 | (Опционально) Personal Record | Ввод PR на табе «Рекорд» |
| 7 | Назад | Возврат в каталог (`from` param) |

### 5.3. Сохранённые упражнения (bookmarks)

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Exercises hub → «Сохранённые» | `/exercises/saved` |
| 2 | Список только bookmarked | Те же карточки + add to plan |
| 3 | Swipe / toggle bookmark | Undo «Убрано из сохранённых» |

Данные локальные (localStorage), без облака.

### 5.4. Личные рекорды

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Exercises → Records (`/records`) | Список PR по упражнениям |
| 2 | Тап → detail упражнения | `/exercise/[id]` |
| 3 | Swipe delete | Undo восстановление |

---

## 6. Live Workout — под-сценарии

### 6.1. Логирование подхода (happy path)

1. Выбрано упражнение (mobile: одно на экран).
2. Строка подхода: weight input, reps input.
3. Chip «прошлый раз» — one-tap prefill.
4. **Done** — set completed, autosave.
5. Rest timer (если `restSec > 0` в плане).
6. **Next** — фокус на следующий подход / упражнение.

### 6.2. Superset / OR-группа

- **Superset:** после подхода → автопереход к следующему в группе; UI показывает позицию в группе.
- **OR (альтернатива):** перед стартом — picker какой вариант делать; можно сменить mid-session.

### 6.3. Пропуск упражнения

1. Действие Skip → bottom sheet подтверждения.
2. Confirm → упражнение помечено skipped, переход дальше.

### 6.4. Досрочное завершение

1. **Finish** → bottom sheet «Завершить и сохранить?» (или «Все подходы готовы» + hint).
2. Кнопки: **«Ещё нет»** (secondary, сверху на узком экране) → **«Завершить»** (primary, снизу / справа) — primary в thumb zone.
3. Confirm → summary (даже если не все подходы).
4. **Discard** → sheet «Отменить без сохранения?» → `/workouts`, сессия удалена.

### 6.5. Смена плана mid-session

При старте другого плана при активной сессии — offer: завершить текущую / отменить / продолжить старую.

### 6.6. Offline / autosave

- Каждое изменение → `localSessionRepository`.
- Закрытие вкладки / PWA → при возврате сессия на месте.
- Wake Lock на live-экране (экран не гаснет).

---

## 7. Post-workout

### 7.1. Summary (`/workouts/summary?id=`)

| Элемент | Содержание |
|---------|------------|
| Статус | «Тренировка завершена» ✓ |
| Метрики | Длительность, подходы, объём (kg) |
| Список | Упражнения с logged sets (expand/collapse) |
| Guest hint | «Сохранить в аккаунте?»: secondary «Войти» + ghost «Позже» |
| CTA | Sticky **«Готово»** (единственный primary на mobile) → history |

### 7.2. История (`/workouts?tab=history`)

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Список сессий (дата, план, duration, sets) | Swipe delete → undo |
| 2 | Тап по сессии | `/workouts/history/[id]` |
| 3 | Просмотр всех подходов | Read-only |
| 4 | Edit mode | Inline правка weight/reps, add/remove sets |
| 5 | «Отправить в редактор» | Создаёт draft из сессии → builder |
| 6 | Clear all history | Sheet подтверждения → очистка → toast **undo** (3 с) восстанавливает все сессии |

---

## 8. Аутентификация и профиль

**Экран:** `/auth` (`src/routes/auth/+page.svelte`).  
**Store:** `src/lib/stores/auth.ts`.  
**Domain:** `src/lib/domain/authFlow.ts` (redirect safety, error map, display helpers).  
**Ops:** Supabase dashboard - см. `.cursor/rules/supabase-auth.mdc`.

### 8.0. Точки входа на `/auth`

| Откуда | URL | `next` после входа |
|--------|-----|-------------------|
| Home hero / chip | `/auth?next=%2F` | `/` |
| Summary (guest hint) | `/auth?next=%2F` | `/` |
| Records empty | `/auth?next=%2Frecords` | `/records` |
| Technique clips publish | `/auth?next=%2Fexercise%2F{id}` | `/exercise/[id]` |
| Account chip / sidebar | `/auth?next={current path}` | текущий маршрут |
| Tabbar / sidebar «Войти» | `/auth?next=…` | см. `safeRedirectPath` |

**Redirect guard (`safeRedirectPath`):** только same-origin path (`/…`). Блокируются: внешние URL, `//evil`, `\`, петля `/auth`. Fallback без `next`: **`/workouts`**.

**QA dev-only:** `?skeleton=account` / `?skeleton=guest` - принудительный boot skeleton.

---

### 8.1. Гость без аккаунта (happy path)

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Открыть app впервые | Полный offline-цикл без регистрации |
| 2 | Home | Hero «Тренируйтесь без аккаунта» + «Создать тренировку» |
| 3 | Создать план, провести сессию | Данные только в localStorage |
| 4 | Summary | Dismissible hint «Сохранить в аккаунте?» |
| 5 | `/auth` | Вкладки **Вход** / **Регистрация**, email+пароль, ссылка magic link |
| 6 | Блок «Интерфейс» | Язык + тема (доступны **до** входа) |
| 7 | Блок «Резервная копия» | Export/import без аккаунта (§8.5) |
| 8 | Footer | Privacy link + `v{version}` |

---

### 8.2. Вход email + пароль

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | `/auth` → вкладка **Вход** | Email + пароль, «Забыли пароль?», «Войти по ссылке на email» |
| 2 | Валидные credentials | Toast «Вы вошли. Данные синхронизируются» → redirect на `next` |
| 3 | Неверный email/пароль | Inline error + toast «Неверный email или пароль»; поля `aria-invalid` flash |
| 4 | Email не подтверждён | «Подтвердите email по ссылке из письма» |
| 5 | Пустой submit | HTML5 `required` блокирует отправку |
| 6 | Пароль &lt; 6 символов | HTML `minlength=6` + Supabase `weakPassword` |
| 7 | Double-tap submit | Кнопка disabled + spinner «Подождите…» |
| 8 | Supabase не настроен | Toast «Вход пока недоступен» (не cloud-off panel, если keys есть но метод упал) |

**Показать/скрыть пароль:** eye toggle, touch target ≥ 48px.

---

### 8.3. Регистрация email + пароль

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Вкладка **Регистрация** | + поле «Ещё раз пароль» |
| 2 | Пароли не совпадают | «Пароли не совпадают» (до сети) |
| 3 | Email уже занят | «Этот email уже зарегистрирован. Войдите» |
| 4 | Signup OK, **нет** session (confirm email ON) | Toast «Регистрация выполнена» → panel **«Проверьте почту»** |
| 5 | Signup OK, **есть** session (confirm OFF) | Toast sign-in → сразу redirect на `next` |
| 6 | Клик по ссылке из письма | Callback `/auth?code=…` или hash → toast sign-in → redirect `next` |
| 7 | Rate limit | «Слишком много попыток. Подождите минуту» |

Placeholder пароля: «Минимум 6 символов» (`PasswordField` minlength=6).

---

### 8.4. Magic link (OTP)

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | «Войти по ссылке на email» | Panel magic: только email |
| 2 | Submit | Toast «Ссылка отправлена на почту» → **Проверьте почту** (kind=magic) |
| 3 | «Войти с паролем» | Назад на sign-in |
| 4 | Клик по ссылке | `/auth` callback → session → redirect `next` |
| 5 | Устаревшая ссылка | «Ссылка устарела. Запросите новую» |
| 6 | Новый email | `shouldCreateUser: true` - создаёт аккаунт |

---

### 8.5. Забыли пароль / recovery

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Sign-in → «Забыли пароль?» | Panel forgot: email |
| 2 | Submit | Toast reset → **Проверьте почту** (kind=reset) |
| 3 | «К входу» | Sign-in panel |
| 4 | Клик reset link | `/auth?recovery=1` + session → **Новый пароль** (не обычный профиль) |
| 5 | Пароли не совпадают | Mismatch error |
| 6 | Тот же пароль | «Новый пароль должен отличаться от старого» |
| 7 | Успех | Toast «Пароль обновлён» → redirect `next` |
| 8 | Устаревшая ссылка | linkExpired |

Recovery UI скрывает guest tabs; только form new password + confirm.

---

### 8.6. Google OAuth

**Текущий код:** `googleOAuthEnabled = false` - кнопка **не показывается**.

Если включить в `authFlow.ts`:

| Шаг | Ожидание |
|-----|----------|
| Tap Google | Redirect OAuth (`prompt=select_account`) |
| Provider off в Supabase | «Этот способ входа ещё не включён в проекте» |
| Success | Callback → profile с badge **Google**, avatar из metadata |

---

### 8.7. После входа: миграция и sync

| Сценарий | Поведение |
|----------|-----------|
| **Гость → первый login** на этом устройстве | Local data **сохраняется** → `migrateLocalToCloud()` merge by id → toast «Данные с этого телефона загружены в аккаунт» |
| **Logout** | `clearUserLocalData()` - планы/сессии/рекорды/bookmarks/draft **стираются локально** |
| **Смена аккаунта** (user A → user B) | Local cache wipe → cloud data user B |
| **Тот же user** re-login | noop, без wipe |
| Cloud list timeout | migrate best-effort; sessions upload async в фоне |
| `dataBootstrap` false | Home/Workouts ждут перед hero (нет flash пустого) |

Merge правило: plan/record/session попадает в облако только если **id ещё нет** в cloud.

---

### 8.8. Профиль (signed in)

| Блок | Действия | Edge cases |
|------|----------|------------|
| **Hero** | Avatar (Google URL / initials / guest letter), имя, email, provider badge | Broken avatar → fallback initials |
| **Имя в приветствии** | Input + Save | Disabled если не dirty; max length `GREETING_NAME_MAX`; sync cloud |
| **Интерфейс** | RU/EN, dark/light | Row tap cycles |
| **Сессия** | Rest timer sound toggle | iOS-specific hint text |
| **Резервная копия** | Export JSON + CSV, import | §8.9 |
| **Опасная зона** | Delete account | §8.10 |
| **Аккаунт** | Privacy, Logout | Logout toast «Вы вышли» |

Desktop: SubrouteBack + title; mobile: ScreenHeader с back на `next`.

---

### 8.9. Резервная копия (export / import)

**Где:** `/auth` (гость и signed in), также блок backup на `/workouts` для гостя.

#### 8.9.1. Скачать копию

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Открыть `/auth`, секция «Резервная копия» | Две кнопки: «Скачать копию», «Восстановить из файла» |
| 2 | Тап «Скачать копию» при пустых данных | Toast info «Пока нечего сохранять» (без undo) |
| 3 | Создать план / сессию локально, повторить export | Скачивается `repdraft-backup-*.json` |
| 4 | После успеха | Toast success «Копия сохранена» |

**Visual QA (toast):** одна строка, компактная высота, крестик по центру справа.

#### 8.9.2. Восстановить из файла

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Тап «Восстановить из файла» | Системный file picker (`.json`) |
| 2 | Выбрать валидный backup | Bottom sheet «Восстановить из копии?» |
| 3 | Прочитать текст | Без длинного тире; три коротких предложения про merge |
| 4 | Тап «Отмена» или backdrop | Sheet закрывается, данные не меняются |
| 5 | Повторить → «Восстановить» | Merge локально; toast «Данные восстановлены» |
| 6 | (Cloud) sync не прошёл | Toast «Синхронизация с облаком отложена…» |

**Visual QA (bottom sheet):**

- Нет серой линии (`border`) сверху карточки
- Нижние углы без «просвета» blur под карточкой (iOS)
- Кнопки с `radius-control` (16px), не pill
- Blur только на overlay, не на content-слое sheet

#### 8.9.3. Невалидный файл

| Файл | Toast |
|------|-------|
| Не JSON | «Не удалось прочитать файл» (error) |
| JSON не Repdraft | «Это не файл резервной копии Repdraft» |
| Unsupported version | «Версия файла не поддерживается» |

---

### 8.10. Удаление аккаунта

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Signed in → «Опасная зона» | Список что удалится (планы, рекорды, сессии, clips) |
| 2 | «Удалить аккаунт» | Inline confirm: ввести **УДАЛИТЬ** (RU) / **DELETE** (EN) |
| 3 | Неверное слово | Final button disabled |
| 4 | Escape | Отмена confirm |
| 5 | «Удалить навсегда» | `POST /api/account/delete` + Bearer token |
| 6 | Успех | Toast «Аккаунт удалён» → `/`; local wipe + signOut |
| 7 | Нет session | «Войдите снова, чтобы удалить аккаунт» |
| 8 | Нет `SUPABASE_SERVICE_ROLE_KEY` на сервере | 503 «Удаление аккаунта временно недоступно…» |

Сервер удаляет: `technique_clips`, sessions, records, plans, storage GIFs, Auth user.

---

### 8.11. Cloud off (Supabase не настроен)

| Шаг | Ожидание |
|-----|----------|
| `PUBLIC_SUPABASE_*` пусты | После boot: panel «Вход пока недоступен» + guest settings (lang/theme/backup) |
| Offline-first app | Планы/сессии/рекорды работают локально |
| Clips publish / cloud save | `errors.cloudOff` |
| Delete account | Недоступно (нет Supabase client) |

---

### 8.12. Auth-триггеры в других экранах

| Экран | Поведение без входа |
|-------|---------------------|
| `/records` | Empty CTA «войдите» (sync hint) |
| Technique clips | «Войдите, чтобы публиковать…» + toast при action |
| Summary | Guest sync banner |
| Home (signed in) | Greeting + avatar chip |

---

### 8.13. Матрица edge cases (auth)

| # | Edge case | Ожидаемое поведение | Как проверить |
|---|-----------|---------------------|---------------|
| 1 | `next=https://evil.com` | Redirect на `/workouts` | `/auth?next=https://evil.com` → login → URL |
| 2 | `next=/auth` | Fallback `/workouts` | Manual |
| 3 | OAuth callback с `?code=` | Toast + redirect, replaceState | Real provider |
| 4 | Hash `access_token` legacy | То же через `$effect` hash test | Supabase redirect |
| 5 | Signup + confirm email OFF | Instant session, no check-email panel | Dashboard setting |
| 6 | Signup + confirm ON | check-email, login blocked until confirm | try sign-in unconfirmed |
| 7 | Magic on existing password account | Link login works | same email |
| 8 | Logout с активной live session | Local wipe; session gone after reload | logout mid-workout |
| 9 | Login user B after user A | Local A wiped; cloud B shown | two test accounts |
| 10 | Guest data + login | migrate toast; plans visible in cloud | guest plan → login |
| 11 | Duplicate plan ids impossible locally | Merge skips existing cloud ids | code review |
| 12 | Recovery без session | Forgot form only, no new password UI | open `/auth?recovery=1` guest |
| 13 | Google button | **Hidden** (`googleOAuthEnabled=false`) | visual |
| 14 | Rate limit spam magic | Error toast | 5+ rapid sends |
| 15 | Import backup signed in | Merge + cloud sync deferred toast | §8.9.2 |
| 16 | Lang switch on check-email | Copy updates RU/EN | toggle lang |
| 17 | Boot skeleton account | `dataset.authBoot=account` or `?skeleton=account` | hard refresh signed in |
| 18 | Avatar `javascript:` URL | Rejected, initials fallback | unit: authFlow selfcheck |
| 19 | Delete partial server fail | Toast deleteFail, account may remain | staging without tables |
| 20 | `npm run check:auth` | Domain selfcheck green | CI / local |

---

## 9. Вспомогательные и edge-case сценарии

| Сценарий | Триггер | Поведение |
|----------|---------|-----------|
| Пустой builder save | 0 упражнений | Блок / empty state |
| План без упражнений | Start на preview | Missing state → builder |
| Undo в builder | Удаление упражнения из draft | Toast + restore at index |
| Toast empty export | Export без данных | Info toast, compact, close centered |
| Toast undo | Удаление плана / bookmark / PR | Undo + countdown ring, tap «Отменить» |
| Bottom sheet on /auth | Backup import | Стили из global CSS, не live-only |
| Auth logout wipe | Logout signed in | Local plans/sessions cleared (by design) |
| Auth account switch | Login as other user | Previous user local data gone |
| Auth guest migrate | Guest plan → login | Toast migrate + cloud merge |
| Auth redirect open | `?next=//evil` | Lands on `/workouts` after login |
| Cloud sync uncertain | Supabase merge | Banner «данные могут обновиться» |
| PWA install hint | iOS / eligible | Bottom hint dismiss |
| Deep link exercise | `/exercise/[id]` | Detail standalone |
| Back navigation | `from` query | Contextual back label |
| Reduced motion | OS pref | Animations off |
| Articles | `/articles/[slug]` | Read-only контент |

---

## 10. Приоритеты MVP

```text
P0 (священный цикл)
├── Home → Preview → Live → Log set → Finish → Summary → History
├── Continue active workout
└── Create plan → Pick exercises → Save → Start

P1 (поддержка цикла)
├── Edit plan / builder polish
├── Exercise detail (history, PR, technique)
├── History edit / send to builder
├── Bookmarks + records
└── Guest → auth → sync

P2 (вне MVP — не блокирует цикл)
├── Analytics / charts
├── Social / AI / wearables
└── Native apps
```

---

## 11. UX-принципы в сценариях

1. **Один primary CTA на экран** — пользователь всегда знает «что дальше».
2. **Active Workout — центр** — максимум внимания UI/UX на live flow.
3. **Offline-first** — мутации сначала локально, sync потом.
4. **No blocking loaders** — skeleton / optimistic UI.
5. **Undo вместо confirm** — для деструктивных действий вне live finish/discard.
6. **Bottom sheets на mobile** — подтверждения не перекрывают весь контекст.
7. **Touch targets ≥ 48px** - в зале тап пальцем / в перчатках.
8. **User-facing copy** - без длинного тире (`—`); пустые значения через `-`, не em-dash.

---

## 12. Чеклисты ручного тестирования

Использовать после правок UI, i18n, backup, toasts, bottom sheets.  
**Платформы:** iOS Safari PWA (приоритет), Android Chrome, desktop ≥1024px.

### 12.1. Bottom sheet (общий)

| # | Проверка | Где открыть |
|---|----------|-------------|
| 1 | Нет `border-top` / серой черты на карточке | `/auth` → import backup |
| 2 | Углы карточки чистые, фон не просвечивает | То же, light theme |
| 3 | Backdrop blur есть, карточка opaque white/dark surface | То же |
| 4 | «Отмена» + primary в одну строку (широкий экран) | То же |
| 5 | На узком (<380px) кнопки stack в колонку | Уменьшить viewport |
| 6 | Tap вне карточки закрывает sheet | Backdrop tap |
| 7 | Finish / discard / skip live | `/live/[planId]` |
| 8 | Clear history | `/workouts` → history tab |
| 9 | Builder clear draft | `/builder` с упражнениями |

### 12.2. Toasts

| # | Проверка | Как вызвать |
|---|----------|-------------|
| 1 | Однострочный toast компактный (~40px) | Export empty на `/auth` |
| 2 | Крестик закрытия по вертикали по центру | Любой info toast |
| 3 | Undo toast выше, ring + секунды | Удалить план → undo |
| 4 | Tap undo восстанавливает сущность | Builder remove exercise |
| 5 | Toast не перекрывает FAB / sticky CTA | `/workouts` с FAB |
| 6 | Live: toast под header, не под inputs | Active workout |
| 7 | Error toast (красный) readable close | Invalid backup file |

### 12.3. Builder (undo + группировка)

| # | Проверка | Шаги |
|---|----------|------|
| 1 | Удаление упражнения → undo → на том же месте | `/builder`, 3+ упражнения, remove middle |
| 2 | Hint группировки при ≥2 упражн., <2 selected | Не выбирать checkbox |
| 3 | Hint скрывается при 2+ selected | Toolbar «Выбрано · N» в chrome |
| 4 | Chip inputs (sets/reps/rest, superset) | Компактные field-chips; заголовок не налезает на delete/reorder |
| 5 | Mobile: одна кнопка «+ Добавить» | Только sticky; inline «+ Добавить упражнение» скрыта (`hidden lg:block`) |

### 12.4. Copy / i18n smoke

| # | Проверка |
|---|----------|
| 1 | RU + EN: backup confirm без `—` |
| 2 | Meta description `/` без «calm» и без em-dash |
| 3 | Пустой вес/повторы в history/summary показывают `-` |
| 4 | Переключение языка на `/auth` → тексты sheet/toast обновляются |

### 12.5. Регрессия маршрутов без `live.css`

Эти экраны **не** импортируют `live.css` - UI-паттерны должны работать из global bundle:

| Маршрут | Что проверить |
|---------|---------------|
| `/auth` | Backup sheet, toasts, icon buttons |
| `/` | Home toasts, session card |
| `/builder` | Bottom sheet clear, undo |
| `/exercises`, `/catalog/*` | Filter sheet, bookmark undo |
| `/records` | Delete undo |

### 12.6. Auth (полный прогон)

**Pre:** Supabase dashboard по `.cursor/rules/supabase-auth.mdc`. Тестовый email + второй аккаунт для switch.

| # | Сценарий | Шаги | Pass |
|---|----------|------|------|
| 1 | Guest `/auth` UI | Вход/Регистрация tabs, magic link, interface prefs, backup, version | ☐ |
| 2 | Sign up + confirm | Register → check-email → click link → lands on `next` | ☐ |
| 3 | Sign in wrong password | Error inline + toast | ☐ |
| 4 | Sign in unconfirmed | emailNotConfirmed message | ☐ |
| 5 | Magic link | Send → email → login without password | ☐ |
| 6 | Forgot → recovery | Reset email → new password form → save → login | ☐ |
| 7 | Password mismatch | Signup/recovery with different confirm | ☐ |
| 8 | Guest → login migrate | Create plan as guest → login → plan in account + toast | ☐ |
| 9 | Logout | Data cleared locally; guest home | ☐ |
| 10 | Account switch | User A logout → User B login → no A data | ☐ |
| 11 | Greeting name save | Edit name → Home greeting updates | ☐ |
| 12 | Delete account | Type confirm word → removed → guest `/` | ☐ |
| 13 | `next` redirect | `/auth?next=%2Frecords` → login → `/records` | ☐ |
| 14 | Open redirect block | `?next=https://evil.com` → `/workouts` | ☐ |
| 15 | Cloud off | Unset env → cloud-off panel, local still works | ☐ |
| 16 | Light theme auth | Screenshot match (как на референсе): tabs, fields, prefs card | ☐ |
| 17 | RU ↔ EN on auth | All panels: signin, magic, check-email, profile | ☐ |
| 18 | `npm run check:auth` | Selfcheck green | ☐ |

**Light theme visual (из QA скрина):** segmented tabs читаемы; поля email/пароль с toggle; блок «Интерфейс» отделён panel; нет лишних borders между секциями.

**Playwright (автоматизация):** `tests/e2e/auth-scenarios.spec.ts` — зеркалит чеклист §12.6.

```bash
npx playwright test tests/e2e/auth-scenarios.spec.ts
```

Опционально для signed-in / redirect / migrate:

```bash
E2E_AUTH_EMAIL=you@example.com E2E_AUTH_PASSWORD='…' npx playwright test tests/e2e/auth-scenarios.spec.ts
```

Magic link / forgot skip с причиной, если Supabase возвращает ошибку (dashboard / redirect URLs).

### 12.7. Home / Live / Builder / Onboarding (ретest 2026-08-31)

| # | Проверка | Pass |
|---|----------|------|
| 1 | Home: hero Start — иконка Play (mobile), текст (desktop) | ☐ |
| 2 | Home: continue card — Play icon-only CTA, `aria-label` «Продолжить тренировку» | ☐ |
| 3 | Tabbar Workouts: **нет** фиолетовой точки; при live — расширенный `aria-label` | ☐ |
| 4 | Live nav: **все** упражнения с белым chip-фоном; active — accent border | ☐ |
| 5 | Live finish sheet: «Ещё нет» → «Завершить» (stack <380px) | ☐ |
| 6 | Builder group toolbar: label + кнопки в одну строку, ровные отступы | ☐ |
| 7 | Summary: grid stats + один sticky «Готово»; guest hint не дублирует primary | ☐ |
| 8 | PWA install hint: контраст, отступ от блока выше | ☐ |
| 9 | Fresh guest (`/?onboarding=reset`): checklist на Home, secondary «Попробовать демо» | ☐ |
| 10 | Demo path: preview → live → 1 set → finish → celebration panel | ☐ |
| 11 | Coachmark «Понятно» — dismiss persist после reload | ☐ |
| 12 | `/auth`: «Как пользоваться» + readonly checklist replay | ☐ |
| 13 | `/articles`: блок «С чего начать» первым при пустом поиске | ☐ |
| 14 | Workouts history empty: mock row + CTA start/demo | ☐ |
| 15 | Draft dock hint после выхода из builder с черновиком | ☐ |

**Playwright (автоматизация):** `tests/e2e/onboarding-guest-demo.spec.ts` — demo → live → finish + coachmark dismiss.

```bash
npx playwright test tests/e2e/onboarding-guest-demo.spec.ts
```

**Не автоматизировано (ручной чекlist):** finish sheet UX, history edit, PWA hint на device, continue card на реальном iPhone, usability test 3 новичков (см. onboarding-v0.15.0-plan §9 Phase E).

---

## 13. Сценарии по страницам (актуально на 2026-08-31)

Краткая карта: **цель → вход → primary CTA → ключевые действия → edge cases**.  
Ретest: `npm run check`, `npm run check:domain`, Playwright (см. §14).

### `/` — Home

| | |
|---|---|
| **Цель** | Быстро начать или продолжить тренировку |
| **Вход** | Tabbar Home, deep link `/` |
| **Primary CTA** | Hero «Начать» (Play на mobile) → preview или `/workouts` |
| **Сценарии** | (1) Есть план → hero с названием; (2) Live session → карточка «Тренировка идёт» + Play; (3) Гость без планов → create hero |
| **Edge** | Boot skeleton; greeting name; pin next plan |
| **Retest** | ✅ visual `home`; manual hero + continue card |

### `/workouts` — планы и история

| | |
|---|---|
| **Цель** | Выбрать план, управлять списком, смотреть историю |
| **Вход** | Tabbar Workouts; `?tab=history` |
| **Primary CTA** | FAB «+» (mobile) → `/builder?new` |
| **Вкладка «Мои»** | Список планов, swipe delete/pin/reorder, tap → preview |
| **Вкладка «История»** | Список сессий; swipe delete + undo; clear all → **sheet** → undo toast |
| **Edge** | Guest backup block; cloud sync banner |
| **Retest** | ✅ visual `workouts`; ✅ history clear undo (manual) |

### `/workouts/[planId]` — превью плана

| | |
|---|---|
| **Цель** | Увидеть программу до старта |
| **Primary CTA** | Sticky **«Начать»** → `/live/[planId]` |
| **Сценарии** | Список упражнений, superset/OR badges; edit → builder |
| **Edge** | Пустой план → redirect builder; active session → switch offer |
| **Retest** | ✅ sacred-loop e2e (preview → live) |

### `/live/[planId]` — активная тренировка

| | |
|---|---|
| **Цель** | Записать подходы максимально быстро |
| **Primary CTA** | **«Далее»** / **«Готово»** на подходе; sticky **«Закончить»** |
| **Сценарии** | Weight×reps → done → rest → next; LiveExerciseNav (chips с фоном); skip/finish/discard sheets |
| **Edge** | OR picker; superset rotation; wake lock; autosave |
| **Retest** | ✅ sacred-loop e2e; snapshot `sacred-loop-live` обновлён (nav chips) |

### `/workouts/summary` — итог

| | |
|---|---|
| **Цель** | Подтвердить результат тренировки |
| **Primary CTA** | Sticky **«Готово»** → `/workouts?tab=history` |
| **Сценарии** | Метрики (duration, sets, volume); список подходов; guest sync hint |
| **Edge** | Стили в `workouts.css` (не home.css); один primary на viewport |
| **Retest** | ✅ manual grid + guest hint layout |

### `/workouts/history/[id]` — деталь сессии

| | |
|---|---|
| **Цель** | Просмотр / правка прошлой тренировки |
| **Primary CTA** | Read-only по умолчанию; edit mode → save |
| **Сценарии** | Inline edit sets; «В редактор» → builder draft |
| **Edge** | Delete session + undo |
| **Retest** | ☐ manual edit flow |

### `/builder`, `/builder/[planId]` — редактор

| | |
|---|---|
| **Цель** | Собрать или изменить план |
| **Primary CTA** | Sticky **«Сохранить»** (mobile) / toolbar save (desktop) |
| **Сценарии** | Add exercises; chips sets×reps×rest; superset/OR; reorder; swipe delete |
| **Edge** | Mobile: **одна** кнопка add (sticky); clear draft sheet; group toolbar при 2+ selected |
| **Retest** | ✅ visual `builder-empty`; ✅ sacred-loop create path |

### `/exercises` — hub каталога

| | |
|---|---|
| **Цель** | Найти упражнение |
| **Primary CTA** | Зоны / поиск → catalog |
| **Сценарии** | Links: saved, records; picker mode `?from=` |
| **Retest** | ✅ visual `exercises-hub` |

### `/catalog/*` — список упражнений

| | |
|---|---|
| **Цель** | Browse / search / filter |
| **Primary CTA** | **+** на карточке (picker) или tap → detail |
| **Edge** | Filter bottom sheet; infinite scroll / pagination |
| **Retest** | ✅ visual `catalog-chest` |

### `/exercise/[id]` — карточка упражнения

| | |
|---|---|
| **Цель** | Техника, история, PR, добавить в план |
| **Primary CTA** | Sticky **«+ Добавить в план»** |
| **Сценарии** | Tabs; bookmark; technique clips; session history |
| **Retest** | ✅ visual `exercise-detail` |

### `/exercises/saved` — закладки

| | |
|---|---|
| **Цель** | Быстрый доступ к сохранённым |
| **Primary CTA** | Add to plan / open detail |
| **Edge** | Remove bookmark + undo |
| **Retest** | ✅ visual `saved` |

### `/records` — личные рекорды

| | |
|---|---|
| **Цель** | Список PR |
| **Primary CTA** | Tap → exercise detail |
| **Edge** | Guest empty → auth CTA |
| **Retest** | ✅ visual `records` |

### `/auth` — профиль и вход

| | |
|---|---|
| **Цель** | Auth, язык, тема, backup, logout |
| **Primary CTA** | Context: «Войти» / «Сохранить» / export |
| **Сценарии** | §8 полностью |
| **Retest** | ✅ visual `auth`; ✅ auth-scenarios e2e (26 pass, 7 skip) |

### `/privacy`, `/articles/*`

| | |
|---|---|
| **Цель** | Legal / контент (P2) |
| **Primary CTA** | Read-only |
| **Retest** | ☐ smoke only |

### Глобальные overlay

| Компонент | Сценарий |
|-----------|----------|
| **Draft Dock** | Draft с упражнениями → jump `/builder` |
| **PwaInstallHint** | iOS eligible → dismiss; стили в `shell.css` |
| **ToastStack** | Feedback + undo 3s |
| **Tabbar** | Home / Workouts / Exercises; скрыт на immersive subroutes |

---

## 14. Журнал автоматического ретestа

| Дата | Команда | Результат |
|------|---------|-----------|
| 2026-08-31 | `npm run check` | ✅ 0 errors |
| 2026-08-31 | `npm run check:domain` | ✅ all selfchecks ok |
| 2026-08-31 | `npx playwright test tests/e2e/sacred-loop.spec.ts tests/e2e/auth-scenarios.spec.ts` | ✅ 27 pass, 7 skip (auth creds); snapshot live обновлён |
| 2026-08-31 | `npx playwright test tests/e2e/visual.routes.spec.ts` | ✅ 22 pass (mobile + desktop) |
| 2026-08-31 | Manual QA (сессия Cursor) | Builder chips, group bar, history undo, home CTAs, tabbar dot removed, live nav bg |

**Не автоматизировано (ручной чекlist §12.7):** finish sheet UX, history edit, PWA hint на device, continue card на реальном iPhone.

---

_Обновлять при изменении маршрутов, навигации, P0-flow, auth или UI-паттернов (toast, sheet, backup). Last reviewed: 2026-08-31 (ретest + §13 по страницам)._
