<!-- source: .cursor/skills/ru-gym-names/SKILL.md -->
<!-- synced: 2026-09-23 -->

---
name: ru-gym-names
description: >-
  Russian gym jargon for Repdraft exercise titles (name_ru). Use when fixing
  catalog translations, awkward word order, stretch names, phone reports of
  bad titles, or running translate:names / overrides.
---

# Russian gym exercise titles (`name_ru`)

Goal: titles that sound like a trainer in a RU gym, not a word-by-word EN→RU calque.

Canonical bake path: [`scripts/translate-exercise-names.py`](../../scripts/translate-exercise-names.py)  
Overrides: `static/data/exercise-names.ru.overrides.json` + `src/lib/data/exerciseNamesRuOverrides.json`  
Command: `npm run translate:names` (script + `build:data`)

Technique / steps RU: [`scripts/apply-exercise-instructions-ru.py`](../../scripts/apply-exercise-instructions-ru.py)  
Sources: `static/data/exercise-instructions.ru.generated.json` + curated `…ru.overrides.json` (overrides win).  
After editing polish rules or generated/overrides: `python3 scripts/apply-exercise-instructions-ru.py`

## When to use

- User reports a weird Russian title (screenshot / inbox).
- Sweep or patch `name_ru` **or** technique steps (`instruction_steps.ru` / `instructions.ru`).
- Adding PHRASES / `GYM_STANDARD_OVERRIDES` / id overrides.
- Prompt: `поправь название` · `ru gym names` · `translate:names` · `техника` · `описания упражнений`.

## Do not

- Invent Fitbod-style AI naming product work.
- Mass-regenerate all 1300+ titles with a raw LLM and commit blindly.
- Prefer bookish anatomy over gym speech for popular lifts (`сгибание локтевых` vs `подъём на бицепс`).
- Leave genitive-first salads (`Шеи боковой растяжка`, `Трицепса отжимания`).

## Source priority (highest wins)

1. **Id override** in `GYM_STANDARD_OVERRIDES` or overrides JSON (curated).
2. **Full EN phrase** in `PHRASES` (longer phrases before shorter).
3. Token pipeline + post-fixes in the script (last resort).
4. External check only when unsure:
   - Fitwill RU (`https://fitwill.app/ru/exercise/{id}/{slug}/`) - titles; steps often generic, do not blind-replace Delavier
   - Delavier RU atlas (bookish baseline)
   - Bombatelo / SportWiki / powermens (gym speech)
   - Lyfta (stretches, odd mobility)
5. **Human / product owner** is final arbiter for jargon (`махи` vs `разведения`).

Program: [`.cursor/product/ru-catalog-copy-qa.md`](../../product/ru-catalog-copy-qa.md) (phased A→E research).

## Gym Russian grammar (short)

Order: **movement → body/target (if needed) → position → equipment**.

| Good | Bad |
|------|-----|
| Боковая растяжка шеи | Шеи боковой растяжка |
| Жим гантелей на наклонной скамье | Наклонный жим с гантелями (ok only if established) |
| Разведение гантелей стоя | Гантелей разведение стоя |
| Отжимания на брусьях | Трицепса отжимания на брусьях |
| Подтягивания на бицепс | Бицепса подтягивания |
| Растяжка широчайших на фитболе | На фитболе широчайших растяжка |

Agreement: feminine nouns take feminine adjectives (`боковая растяжка`, not `боковой растяжка`).

Stretches: title should **start** with `Растяжка` / `Боковая растяжка` / `Динамическая растяжка` / `Круговая растяжка` / `Лучшая растяжка` unless it is a known proper name.

Bodyweight: name the movement; add tool only when it disambiguates (script already omits default body weight).

## Technique steps (`instruction_steps.ru`)

Same gym voice. Prefer curated overrides for popular lifts.

Polish in `apply-exercise-instructions-ru.py` must catch calques such as:

| Bad | Good |
|-----|------|
| стабильность мяча | фитбол |
| скамья проповедника | скамья Скотта |
| предакеровский валик | валик скамьи Скотта |
| кабельная машина | блочный тренажёр |

Do not strip intentional «гантель или гиря» from curated goblet overrides.

Scan:

```bash
python3 <<'PY'
import json, re
from pathlib import Path
full = json.loads(Path('data/exercises.full.json').read_text())
bad = re.compile(r'стабильность мяч|проповедника|предакеровск|предсвороточн|[A-Za-z]{5,}', re.I)
left = []
for ex in full:
    text = '\n'.join((ex.get('instruction_steps') or {}).get('ru') or [])
    if bad.search(text):
        left.append((ex['id'], ex.get('name_ru'), bad.findall(text)[:5]))
print('instruction leftovers', len(left))
for row in left[:30]:
    print(row)
PY
```

## Fix algorithm (titles)

1. Read EN `name` + current `name_ru` + id (from index or screenshot route).
2. If instructions exist in `data/exercises.full.json`, skim EN steps when the EN title is nonsense (`incline breeding` → fly).
3. Pick a gym-natural RU title (table + sources).
4. Add **both**:
   - `PHRASES` entry for the full EN string (longer first).
   - `GYM_STANDARD_OVERRIDES["id"] = "Title"`.
5. Run `npm run translate:names`.
6. Re-scan heuristics (below). Remaining must be 0 for the patterns you care about.
7. Commit on the active WIP / release branch. No athlete-facing fluff beyond changelog if this ships in a version bump already open.

### Heuristic scan (paste into shell)

```bash
python3 <<'PY'
import json, re
from pathlib import Path
index = json.loads(Path('static/data/exercises.index.json').read_text())
GEN = re.compile(
    r'^(Шеи|Ног|Рук|Спины|Плеч|Груди|Бедер|Бёдер|Икр|Предплечий|Ягодиц|Трицепса|Бицепса|'
    r'Квадрицепса|Дельт|Запястий|Голени|Пресса|Позвоночника|Аддуктора|Грушевидной|Широчайших)\b'
)
GENDER = re.compile(
    r'\b(боковой|задний|передний|верхний|нижний|узкий|обратный|наклонный|поочерёдный|молотковый)\s+'
    r'(растяжка|тяга|сгибание|разгибание|разведение|скручивание|подтягивания)\b', re.I
)
INV = re.compile(r'\b(над головой|вниз головой)\s+(разгибание|растяжка)\b', re.I)

def stretch_buried(ru: str) -> bool:
    if 'растяж' not in ru.lower():
        return False
    return not re.match(
        r'^(Растяжка|Динамическая растяжка|Лучшая растяжка|Боковая растяжка|Круговая растяжка)\b',
        ru,
    )

left = []
for ex in index:
    ru = ex.get('name_ru') or ''
    reasons = []
    if GEN.search(ru):
        reasons.append('gen-start')
    if GENDER.search(ru):
        reasons.append('gender')
    if INV.search(ru):
        reasons.append('inv')
    if stretch_buried(ru):
        reasons.append('stretch-buried')
    if reasons:
        left.append((ex['id'], ex['name'], ru, reasons))
print('remaining', len(left))
for row in left[:40]:
    print(row)
PY
```

## Inbox / phone dump

If the user sends a screenshot of a bad title:

1. Identify exercise id (search `name` / `name_ru` in `exercises.index.json`).
2. Write the corrected title into overrides (skill algorithm above).
3. Optional Agent card in issue / `.cursor/product/ideas/` only if it is a broader naming policy change, not a one-line fix.

## Popularity triage

When doing a batch: prefer `globalPopularity` high first (index field). Exotic stretches can wait for a report.

## Glossary (gym speech defaults)

| EN family | Prefer RU |
|-----------|-----------|
| bench press | жим … лёжа / жим штанги лёжа |
| overhead / military press | жим над головой / армейский жим |
| lat pulldown | вертикальная тяга |
| seated row | горизонтальная тяга … |
| lateral raise | разведение … стоя (or махи, if product prefers) |
| curl | подъём на бицепс / сгибание … |
| triceps extension / pushdown | разгибание на трицепс / жим к низу |
| dip | отжимания на брусьях / отжимания на трицепс от скамьи |
| shrug | шраги |
| hip hinge RDL | румынская тяга |
| good morning | гудморнинг |
| neck side stretch | боковая растяжка шеи |
| back lever | задний рычаг |

Keep this table small; put one-off titles in overrides, not here.

## Done when

- [ ] Bad title fixed in baked index (`static/data/exercises.index.json`) and full JSON if present.
- [ ] PHRASE and/or id override committed so regenerate does not revive the calque.
- [ ] Heuristic scan clean for the patterns above (or documented exceptions).
- [ ] `npm run translate:names` already run; no need for `npm run check` unless TS/Svelte touched.
