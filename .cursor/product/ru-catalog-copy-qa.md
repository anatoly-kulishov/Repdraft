# RU catalog copy QA (names + technique)

**Goal:** Gym-natural Russian for every `name_ru` and `instruction_steps.ru`, at Fitwill / Bombatelo / Delavier quality. Not EN token glue.

**Reality:** 1324 exercises. Full human Google+competitor pass is multi-batch. This file is the program; execution is phased.

## References (priority)

1. **Fitwill RU** - `https://fitwill.app/ru/exercise/{id}/{slug}/` (same ExerciseDB-style ids when available). List hubs like `/ru/exercises/1/` are browse pages, not one exercise.
2. Bombatelo / SportWiki / powermens (gym speech)
3. Delavier RU atlas (canonical lifts)
4. Lyfta RU (mobility / odd names)
5. Product owner for jargon ties (`махи` vs `разведения`, hyphen styles)

Skill: [`.cursor/skills/ru-gym-names/SKILL.md`](../skills/ru-gym-names/SKILL.md)

## Phases

| Phase | Scope | Done when |
|-------|--------|-----------|
| **A** | Heuristic + mechanical grammar (gender, grip order, sled/cardio calques) | Suspect scan near zero for known patterns |
| **B** | Top popularity (`globalPopularity` ≥ 80) + home-screen / pick-workout paths | Each title+steps checked vs Fitwill/Bombatelo |
| **C** | Suspect list from scan (grip-first salads, sled, version tags, multi-move) | Every hit reviewed or waived with note |
| **D** | Remaining catalog by muscle group batches (~100/batch) | Batch checklist in this file |
| **E** | Continuous: phone inbox screenshot → override same day | Inbox prompt `поправь название` |

## Per-exercise checklist

1. Open EN name + our `name_ru` + RU steps.
2. Open Fitwill RU for same id (or search EN title on Fitwill / Bombatelo).
3. Pick gym title: movement → details → equipment. Prefer competitor consensus when native.
4. Read our steps vs competitor: remove calques (`правильную форму` → `технику`, `основные мышцы` → `мышцы кора` when core). Prefer our Delavier-style steps when Fitwill is generic boilerplate.
5. Bake: `PHRASES` + `GYM_STANDARD_OVERRIDES` + instruction override if steps change.
6. `npm run translate:names` and/or `python3 scripts/apply-exercise-instructions-ru.py`.

## Pipeline notes (agents)

- Full-title `PHRASES` early-return **must** go through `polish_ru_title()` (grip order, sled, scrub leftovers).
- Grip/sled regexes are case-insensitive; titles are lowercase until final capitalize.
- `across`/`face` latin scrub → prefer empty/`у лица`; polish after scrub for `крест-*` leftovers.
- Stale rows in `exercise-names.ru.overrides.json` lock bad titles; fix via `GYM_STANDARD_OVERRIDES` or delete the stale key.
- Keep `Поочерёдный/ая/ое + движение` (do not force `… поочерёдно` for every alternate).

## Batch log

| Batch | Date | IDs / theme | Notes |
|-------|------|-------------|-------|
| A1 | 2026-09-22 | Heuristics: neck, dips, stretches, cardio screenshots, scissors | WIP `v0.18.6` |
| A2 | 2026-09-22 | Grip reorder, sled titles, jack, across-face, narrow grip, polish pipeline | Suspect grip/sled near zero |
| B1 | 2026-09-22 | Top 22 popularity vs Fitwill | Titles aligned; steps kept Delavier where Fitwill is fluff |
| C1 | pending | Remaining suspect scan | |
| D1 | pending | Chest / back / legs batches | |

## B1 research (top 22)

| id | EN | Our `name_ru` | Fitwill RU | Verdict |
|----|----|---------------|------------|---------|
| 0025 | barbell bench press | Жим штанги лёжа | Жим штанги лежа | OK (ё) |
| 0043 | barbell full squat | Приседания со штангой | (CF timeout) | OK gym short |
| 0032 | barbell deadlift | Становая тяга | Становая тяга со штангой | OK shorter |
| 0652 | pull-up | Подтягивания на перекладине | Подтягивания | OK more specific |
| 0426 | dumbbell standing overhead press | Жим гантелей стоя над головой | Жим гантелей стоя над головой | Fixed order |
| 3017 | barbell pendlay row | Тяга Пендлея со штангой | Тяга Пендлея со штангой | OK; our steps better than Fitwill boilerplate |
| 0085 | barbell romanian deadlift | Румынская тяга со штангой | (timeout) | OK |
| 0054 | barbell lunge | Выпады со штангой | - | OK |
| 0251 | chest dip | Отжимания на брусьях на грудь | (timeout) | OK |
| 1326 | chin-up | Подтягивания обратным хватом | Подтягивание обратным хватом | OK plural |
| 0047 | barbell incline bench press | Жим штанги на наклонной скамье | - | OK |
| 0662 | push-up | Отжимания от пола | Отжимание | OK plural + «от пола» |
| 1463 | sled 45° leg press (side pov) | Жим ногами под 45° (вид сбоку) | Жим ногами в санях под углом 45° - вид сбоку | Fixed sled salad |
| 0334 | dumbbell lateral raise | Разведение гантелей стоя | - | OK |
| 0203 | cable rear delt row (with rope) | Тяга блока на заднюю дельту | - | OK |
| 0031 | barbell curl | Подъём штанги на бицепс стоя | - | OK |
| 0061 | barbell lying triceps extension | Французский жим лёжа (другой ракурс) | - | OK gym name |
| 0042 | barbell front squat | Приседания со штангой на груди | - | OK |
| 0095 | barbell shrug | Шраги со штангой | - | OK |
| 1372 | barbell standing calf raise | Подъём на носки со штангой | - | OK |
| 0293 | dumbbell bent over row | Тяга гантели одной рукой в наклоне | - | OK |
| 0585 | lever leg extension | Разгибания ног | - | OK |

Technique: for B1 keep curated Delavier/powermens steps. Fitwill instructions are often generic LLM filler (see Pendlay); do not blind-replace ours with Fitwill steps.

## Do not

- Blind LLM rewrite of all 1324 without competitor check.
- Ship bookish anatomy where the gym says otherwise without owner OK.
- Leave `v. 3` / `(тренажёре)` / `На санях … жим` style salads in Phase A/C.
- Copy Fitwill boilerplate steps over stronger Delavier-style copy.
