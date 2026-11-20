# Smart plan tune («Подстроить под сегодня»)

Athlete writes what hurts / what to emphasise today («болит плечо, акцент на грудь»), AI edits the **existing** plan, the sheet shows a diff, and the session starts from that variant. The saved plan is untouched unless the athlete taps «Сохранить в план».

## Surfaces

| Client | Entry | Sheet |
|---|---|---|
| Web (shipped) | dashed row in the plan summary card (`/workouts/[planId]`) | `src/lib/components/plan/PlanTuneSheet.svelte` |
| RN (not built yet) | — | twin of the web sheet, planned next RN pass |

Copy: `planTune.*` in `src/lib/i18n/messages.ts`; the RN twin reads the same table when it lands.

The shared domain already supports RN: `WorkoutSession.prescriptionLocked` and `startSessionFromPlan(plan, { lockPrescription })` are client-agnostic, and RN's live boot honours the lock.

## Flow

1. Presets («Болит плечо», «Акцент на грудь», «Сегодня полегче», …) append into one free-text brief; the athlete can rewrite it.
2. `POST /api/ai/tune-plan` `{ brief, plan: { name, exercises[] } }` → `{ plan: { name, summary, exercises[] } }`.
   - Same daily quota as `/api/ai` (`aiDailyQuota`, 10/day per key) → 429 `code: 'rate_limit'`.
   - No auth, like the other AI text endpoints.
3. `diffPlanTune` (`src/lib/domain/planTune.ts`) turns the answer into added / removed / changed / reordered rows; the sheet renders it.
4. «Начать с этим» → `live.startFromPlan(tuned, { lockPrescription: true })` and `goto('/live/<planId>')`. «Сохранить в план» → `plans.savePlan` (web store: local + cloud mirror, bumps `updatedAt`).

## Поле ввода (почему такие размеры)

- Поле — shadcn `AppTextarea`. Его базовые утилиты держат высоту 48px, поэтому
  плейсхолдер, перенёсшийся на вторую строку, обрезался по нижнему краю.
  Стиль шита задаёт `min-height: 5.5rem` (три строки) и `max-height: 9.5rem`
  (~шесть строк, дальше внутренний скролл); `field-sizing: content` растит поле
  по мере ввода.
- Правило живёт в `<style>` шита как `:global(textarea.plan-tune__brief)`: сам
  `<textarea>` рендерит дочерний `AppTextarea`, и обычный скоупед-селектор Svelte
  выкинул бы как «unused».
- Счётчик `0/500` стоит в одной строке с лейблом и читает тот же ключ
  `aiDraft.chars`, лимит — `AI_BRIEF_MAX`.
- Пустой сабмит больше не тост: `aria-invalid` + инлайн-ошибка под полем +
  фокус в поле. Красная рамка — общее правило
  `textarea[data-slot='textarea'][aria-invalid='true']` в `controls.css`;
  на `/ai` composer-переопределение выигрывает, там вид не меняется.
- Под полем — «Только сегодня. Сохранённый план не меняется»
  (`planTune.todayOnly`), чтобы посыл не терялся: лид сокращён до вопроса.
- Пресеты — `role="group"` + `aria-pressed`; тап по чипу снимает инлайн-ошибку.

## Why the prescription lock exists

`syncSessionPrescriptionFromPlan` re-applies the saved plan's sets/reps/rest on every live boot (`resumeActiveSession` on web, live `useEffect` on RN). A tuned session would silently revert. Sessions started from a tune carry `prescriptionLocked: true` (`WorkoutSession`) and the sync function returns them untouched.

## Server-side guards (`src/lib/server/ai/tunePlan.ts`)

The model is told the plan is the base and edits should be 1–2, not a rewrite. Code enforces what copy cannot:

- **Catalog whitelist** — ids outside the catalog are dropped, never invented (`droppedUnknownIds`).
- **Variant dedupe** — the catalog carries «(другой ракурс)» twins; `dedupeCatalogVariants` keeps one per movement so a session never gets two close-grip benches. The plan's own ids win the collision.
- **Name guard** — if `name` looks like a plan row (`|`, `×`, «отдых» + digits, > 48 chars), fall back to the plan's current name.
- **Floor** — fewer than `min(3, plan.exercises.length)` rows get padded from the plan's own removed rows (original prescription, never from a zone the brief excludes).
- **Clamps** — sets 1–6, reps 4–30, rest 30–240; `summary` ≤ 160 chars.

## Active session

Starting a tuned variant would overwrite an unfinished session, so the sheet blocks it: «Начать с этим» is disabled with `planTune.activeSession`. The page checks `readActiveSession()` on mount.

## Переход форма ↔ результат

Панели разной высоты (форма ~355 px, результат 400+ px), поэтому шит не просто
подменяет контент:

- одна волна на реальный контент: `paneKey` — только `'result' | 'form'`.
  Нажатие «Подобрать» больше не подставляет панель «busy» (раньше в стеке
  оказывалось три панели, а карточка прыгала в начале свопа).
- вместо волновой шторки — fade-through: `swapOut` 110 мс, затем `swapIn`
  300 мс с подъёмом на 8 px. Движущаяся кромка между двумя текстовыми
  раскладками оставляла читаемыми обе копии сразу (чипы формы под строками
  диффа) и читалась как глитч. Волна осталась для «картинка → картинка».
- высота `.plan-tune` — измеренная высота входящей панели
  (`ResizeObserver` по `.plan-tune__swap-pane:last-child > *`), сама карточка
  едет `transition: height .32s`; обе панели лежат в одной grid-ячейке, лишнее
  режет `overflow: hidden`.
- `prefers-reduced-motion` и `data-reduce-motion` выключают и своп, и высоту.
- закрытие/сохранение сбрасывают шит без видимого свопа (`swapIn`/`swapOut`
  отдают `duration: 0`, если `open === false`); повторное открытие — снова форма.

## Лимит: не тратить вызовы

Квота 10 запросов в день, поэтому один и тот же вопрос не должен стоить дважды:

- **сервер** — `createAiReplyCache` (`src/lib/server/ai/aiReplyCache.ts`): TTL
  10 мин, ключ = квота-ключ + имя плана + brief + нормализованные строки.
  `track()` делает single-flight: повтор и гонка двух одинаковых POST получают
  `cached: true` без второго вызова модели и без списания квоты. Ошибка и
  `unavailable` кэш не отравляют, `unavailable` ещё и возвращает квоту
  (`refundAiDailyQuota`).
- **клиент** — `lastTune` кэширует ответ по `plan.id:plan.updatedAt:brief`:
  повторная та же просьба (ретрай, переоткрытие шита, второй тап) отдаётся без
  запроса. После ошибки — пауза 3 с (`RETRY_COOLDOWN_MS`), повторные тапы
  отсекает `busy || saving`.

## Manual QA (no provider needed)

`/api/ai/tune-plan` needs a live model; everything else is mockable:

1. Seed `repdraft:plans` with a plan, open `/workouts/<id>`, tap «Подстроить под сегодня».
2. `page.route('**/api/ai/tune-plan')` → fulfil with `{ ok: true, plan: { name, summary, exercises } }`.
3. Check the diff, then «Начать с этим»: `repdraft:active-session` has `prescriptionLocked: true` and the tuned rows; `repdraft:plans` is unchanged.
4. Reload `/live/<planId>` — the tuned rows survive.
5. Quota exhausted (429) shows «Лимит ИИ на сегодня исчерпан», the sheet stays open with the brief intact.
