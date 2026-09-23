<!-- source: .cursor/product/ru-catalog-copy-qa.md -->
<!-- synced: 2026-09-23 -->

# RU catalog copy QA (names + technique)

**Goal:** Gym-natural Russian for every `name_ru` and `instruction_steps.ru`, at Fitwill / Bombatelo / Delavier quality. Not EN token glue.

**Reality:** 1324 exercises. Full human Google of every id is not the gate. Gate = phased mechanical polish + popularity + muscle-group suspect sweeps + continuous phone inbox (Phase E).

## References (priority)

1. **Fitwill RU** - `https://fitwill.app/ru/exercise/{id}/{slug}/` (same ExerciseDB-style ids when available). List hubs like `/ru/exercises/1/` are browse pages, not one exercise.
2. Bombatelo / SportWiki / powermens (gym speech)
3. Delavier RU atlas (canonical lifts)
4. Lyfta RU (mobility / odd names)
5. Product owner for jargon ties (`махи` vs `разведения`, hyphen styles)

Skill: [`.cursor/skills/ru-gym-names/SKILL.md`](../skills/ru-gym-names/SKILL.md)

## Phases

| Phase | Scope | Status |
|-------|--------|--------|
| **A** | Heuristic + mechanical grammar (gender, grip order, sled/cardio calques) | **done** |
| **B** | Top popularity (`globalPopularity` ≥ 80) | **done** (B1) |
| **C** | Suspect list from scan | **done** (C1+C2; hard leftovers 0) |
| **D** | Muscle-group sweeps | **done** (D1–D5 via shared polish + spot Fitwill) |
| **E** | Phone inbox screenshot → override same day | **continuous** |

## Per-exercise checklist

1. Open EN name + our `name_ru` + RU steps.
2. Open Fitwill RU for same id (or search EN title on Fitwill / Bombatelo).
3. Pick gym title: movement → details → equipment. Prefer competitor consensus when native.
4. Read our steps vs competitor: remove calques. Prefer Delavier-style steps when Fitwill is generic boilerplate.
5. Bake: `PHRASES` + `GYM_STANDARD_OVERRIDES` + instruction override if steps change.
6. `npm run translate:names` and/or `python3 scripts/apply-exercise-instructions-ru.py`.

## Pipeline notes (agents)

- Full-title `PHRASES` early-return **must** go through `polish_ru_title()`.
- Grip / one-arm / decline / incline rewrites are case-insensitive; re-apply grip+one-arm **after** decline/incline.
- Inline `вариант N` → trailing `(вариант N)`.
- Instruction polish strips `кабельная машина` → `блочный тренажёр`, preacher → Скотта, etc.
- Stale rows in `exercise-names.ru.overrides.json` lock bad titles; fix via `GYM_STANDARD_OVERRIDES`.
- Keep `Поочерёдный/ая/ое + движение` (do not force `… поочерёдно` for every alternate).
- Batches stay small when extending; full-catalog gate is the suspect scans below.

## Done gates (re-run anytime)

```bash
# titles: decline-first / one-arm-first / machine Smith / inline variant
python3 - <<'PY'
import json, re
from pathlib import Path
index = json.loads(Path('static/data/exercises.index.json').read_text())
pat = re.compile(
    r'^(Вниз головой|Одной рукой|Узким хватом|На санях|На животе |Фиксированный)|'
    r'\bв машине Смита\b|вариант \d+(?!.*\(вариант)'
)
left=[(e['id'], e.get('name_ru')) for e in index if pat.search(e.get('name_ru') or '')]
print('title leftovers', len(left))
for row in left[:20]: print(row)
PY

# instructions: known calques
python3 - <<'PY'
import json, re
from pathlib import Path
full=json.loads(Path('data/exercises.full.json').read_text())
bad=re.compile(r'стабильность мяч|проповедника|предакеровск|предсвороточн|кабельн\w*\s+машин|правильную форму', re.I)
left=[]
for ex in full:
    text='\n'.join((ex.get('instruction_steps') or {}).get('ru') or [])
    if bad.search(text):
        left.append(ex['id'])
print('instruction leftovers', len(left))
PY
```

**Current gate (2026-09-22):** title leftovers **0**, instruction leftovers **0**.

## Batch log

| Batch | Date | IDs / theme | Notes |
|-------|------|-------------|-------|
| A1 | 2026-09-22 | neck, dips, stretches, cardio screenshots, scissors | WIP `v0.18.6` |
| A2 | 2026-09-22 | Grip/sled/jack/across-face/narrow grip polish | Suspect grip/sled → 0 |
| B1 | 2026-09-22 | Top 22 vs Fitwill | Titles aligned; Delavier steps kept |
| C1 | 2026-09-22 | One-arm order, variant tags, grip-hyphen | |
| D1 | 2026-09-22 | Chest-adjacent salads | clean-grip front squat, reverse-grip, pullovers |
| C2+D2–D5 | 2026-09-22 | Decline/incline/prone/Smith/machine + back/legs/shoulders/arms/abs sweeps | Shared polish; Fitwill spots (row, pulldown, lateral raise, RDL family); cable-machine instruction calques cleared |

## Spot Fitwill / Bombatelo (samples across groups)

| id | Theme | Our title | Competitor | Verdict |
|----|-------|-----------|------------|---------|
| 0025 | chest | Жим штанги лёжа | Fitwill: Жим штанги лежа | OK |
| 0027 | back | Тяга штанги в наклоне | Fitwill: Тяга штанги в наклоне | OK |
| 0198 | back | Вертикальная тяга | Fitwill: Тяга верхнего блока | OK synonym |
| 0029 | legs | Приседания на груди хватом для взятия | Fitwill: фронтальный присед в чистом хвате | OK gym short |
| 0033 | chest | Жим штанги на наклонной скамье вниз | Fitwill longer «отрицательный наклон» | OK shorter |
| 0334 | shoulders | Разведение гантелей стоя | gym consensus | OK |
| 0085 | legs | Румынская тяга со штангой | Bombatelo/Fitwill family | OK |
| 1463 | legs | Жим ногами под 45° (вид сбоку) | Fitwill sled 45° | Fixed |

## Do not

- Blind LLM rewrite of all 1324 without competitor check.
- Ship bookish anatomy where the gym says otherwise without owner OK.
- Copy Fitwill boilerplate steps over stronger Delavier-style copy.
- Leave decline-first / `машине Смита` / `кабельная машина` salads.
