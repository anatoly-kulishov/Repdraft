# Публичные инструменты: калькуляторы и EN-зеркала

Публичный контент выходит за sacred loop и работает как вход в него: посчитали -> собрали план -> потренировались. Калькуляторы и библиотека программ считаются локально и ничего не отправляют на сервер; UI калькуляторов пока web-only.

## Калькуляторы `/tools/*`

| Роут | Что считает | Математика |
|------|-------------|------------|
| `/tools/one-rep-max` | 1ПМ по рабочему подходу + таблица 70–95% | Эпли, Бжицки, Ломбарди, среднее; обратная Эпли для «примерных повторов» |
| `/tools/calories` | BMR -> TDEE -> калории под цель + БЖУ | Mifflin–St Jeor, коэффициенты активности 1.2–1.9, цель −15% / 0 / +12% |
| `/tools/bmi` | ИМТ, категория, здоровый диапазон веса | вес / рост², ВОЗ 18.5–24.9 |
| `/tools/heart-rate-zones` | Максимальный пульс и 5 зон | Tanaka (208 − 0.7 × возраст), зоны по % максимума или Карвонену при пульсе покоя |

- Домен: `src/lib/domain/tools.ts` (`estimateOneRepMax`, `calcBmrMifflin`, `calcTdee`, `calorieTarget`, `macroSplit`, `calcBmi`, `healthyWeightRange`, `estimateMaxHeartRate`, `heartRateZones`). Чистые функции, никакой сети.
- Ввод ограничен `TOOL_LIMITS`; пустое поле даёт ноль или подсказку, а не `NaN`.
- Значения по умолчанию (180 см / 80 кг) стоят, чтобы страница сразу показывала результат; пользователь меняет их первым делом. Если это начнёт путать, переходим на пустой старт.
- Всё считается в браузере и не сохраняется: ни localStorage, ни cookie.
- Самопроверка: `runToolsSelfCheck()` в `npm run check:domain` (формулы, клампы, порядок зон, диапазон веса).

## UI и i18n

- Роуты: `/tools` (хаб, 4 карточки) + 4 страницы; блок `src/lib/styles/blocks/tools.css`.
- Тексты: ключи `tools.*` и `seo.tool*` в `src/lib/i18n/messages.ts` (ru + en), одинаковый набор на обоих языках.
- Под каждой страницей `ToolTail`: «Что важно знать», заметка и CTA «Собрать тренировку» -> `/builder` (единственная primary-кнопка на экран).
- Разметка для поиска: `WebApplication` + `BreadcrumbList`; у страниц с парой есть `hreflang` `ru` / `en` / `x-default` (x-default = RU).

## EN-зеркала

Правила и ограничения: [`seo-cutover-ru.md`](seo-cutover-ru.md). Коротко:

- RU канонична на голом пути, EN живёт под `/en/...` с self-canonical.
- Зеркала есть у `/tools/*`, `/programs/*` и `/exercise/:id` (у последнего SSR, английские `name` + `instruction_steps.en`).
- Страница принимает `localeOverride` / `pathOverride`; зеркало это тонкая обёртка `src/routes/en/...` с тем же `load`.
- Язык хедера/футера берётся из `resolvedLocale`: на `/en/*` всегда английский, независимо от сохранённой настройки.
- Переключение на русский с `/en/*` уводит на RU-путь внутри `setPreferredLocale`, иначе зеркало залипает на английском.

## Как добавить пятый калькулятор

1. Формулы + границы в `src/lib/domain/tools.ts`, туда же asserts в `runToolsSelfCheck`.
2. Ключи `tools.<id>.*` в оба блока `messages.ts`.
3. Роут `src/routes/tools/<id>/+page.svelte` (+ `+page.ts` с `PRERENDER_PUBLIC`), зеркало `src/routes/en/tools/<id>/`.
4. Карточка в хабе `src/routes/tools/+page.svelte`, запись в `src/lib/seo/sitemap.ts`.
5. `npm run check:domain && npm run check && npm run build`.

## Рейтинг сессии и программы

Живут в sacred loop, не в публичном контенте: локальные ключи `repdraft:session-ratings`, `repdraft:program-runs` и `repdraft:saved-programs`, домен `sessionRating.ts` / `programs.ts`.

Карточка программы показывает частоту, примерное время сессии (`sessionMinutes`: разминка + подходы с отдыхом, округление до 5 минут) и инвентарь блока. Инвентарь это контент `ProgramTemplate.equipment`, и `buildSessionExercises` получает его же как фильтр, поэтому чипы не расходятся с тем, что реально попадёт в план. Закладка «на потом» сортирует сохранённые блоки наверх и живёт только на устройстве. Контракты и почему без БД: [`native-rewrite-plan.md`](native-rewrite-plan.md#публичные-программы-и-рейтинг-сессии).
