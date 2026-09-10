# Copy + onboarding brief (for Kimi / team)

**Product:** Repdraft - gym workout logger (SvelteKit PWA).  
**North star:** Open → Pick workout → Preview → Start → Set → Weight × reps → Next → Finish → Saved.  
**Mantra:** IMPROVE THE EXPERIENCE. NOT THE FEATURE COUNT. Fast on weak phones.  
**Date:** 2026-09-10 · Package line: 0.17.x

Use this doc as the source pack for Kimi (or any UX writer). Do not invent features. Prefer shorter, gym-readable RU/EN pairs.

---

## 1. Positioning (tone of voice)

| Do | Don't |
|----|--------|
| Calm gym notebook: direct, short, one next action | Coach hype, guilt, streak pressure in week 1 |
| Verb + outcome on buttons («Начать», «Сохранить») | Submit / OK / Открыть without context |
| Same word for the same thing (тренировка = plan card) | Mix «план» / «тренировка» / «сессия» without need |
| Blame the UI on errors | «Вы ввели неверно» |
| RU-first; EN matches meaning, not word-for-word | LLM filler, em-dash, poetic labels |

**Gym context:** one hand, sweaty, mid-set. Labels must scan in &lt;1s. Prefer ≤4 words on buttons; coachmarks ≤2 short sentences.

---

## 2. Research synthesis (external)

### Onboarding (fitness apps)

Sources worth keeping:

- [Lifecycle Architect - Onboarding for fitness apps](https://lifecyclearchitect.com/guides/onboarding-optimization-for-fitness-apps/): first meaningful action ~90s; one recommended path; skip-friendly intake; coachmarks sparingly.
- [Stormotion - Fitness app UX](https://stormotion.io/blog/fitness-app-ux/): first workout within ~60s; progressive disclosure; skippable steps.
- [PixelForce / Traininpink](https://pixelforce.com/case-studies/traininpink-data-driven-user-onboarding-improvement): optimize time-to-first-session, not questionnaire completion; guided routing &gt; big menus.
- Internal: [`.cursor/product/onboarding-v0.15.0-plan.md`](onboarding-v0.15.0-plan.md), [`.cursor/product/ux-research-mvp-direction.md`](ux-research-mvp-direction.md).

**Competitors (lesson for Repdraft, not parity):**

| App | Takeaway |
|-----|----------|
| Strong | Think less; one clear Start; no tour of the whole app |
| Hevy | Powerful but signup wall + dense live UI - avoid for day 0 |
| JEFIT / Fitbod | Long quiz / AI intake - out of scope for MVP logger |
| Boostcamp | Template shortcut OK; not program marketplace |

**Activation definition for Repdraft:** finished session (finish → summary), not signup.

### Microcopy

- Buttons: verb + outcome ([Kompassify UX microcopy](https://kompassify.com/blog/ux-microcopy-guide)).
- Empty state: what / why it matters / one CTA ([Smashing - empty states](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/) via prior plan).
- Fitness tone: coach-like, non-judgmental ([Made Good Designs](https://madegooddesigns.com/fitness-app-design/)).
- Gym UI: glanceable, high contrast, no jargon mid-set.

---

## 3. What exists today (code)

```text
Home checklist (5 steps) → Try demo OR create own
  → Preview coachmark → Live (logging + finish coachmarks)
  → Finish → Summary first-finish panel
Parallel coachmarks on builder / exercises / records / history
Auth: «Как пользоваться» + checklist replay + articles
```

**Files:** `src/lib/domain/onboarding.ts`, `src/lib/stores/onboarding.ts`, `src/lib/components/onboarding/*`, `src/lib/i18n/messages.ts`, e2e `tests/e2e/onboarding-guest-demo.spec.ts`.

**Gaps vs plan / new-user pain:**

1. Live still under-explained (rest, next, last-time, set kinds) - only logging + finish coachmarks.
2. Terminology: checklist «план» vs UI «тренировка».
3. First coachmarks too long / power-user (column fill on day 1).
4. No `FirstWinToast`; celebration only on summary.
5. Dead unused keys (`home.guestTitle`, `home.empty*`, …) still in messages.
6. No novice usability pass checked off in the v0.15 plan.

---

## 4. Priority backlog (ship order)

### P0 - Clarity of sacred loop (copy + light UX)

1. Unify term: **тренировка** for plan cards; **сессия** only for finished history; drop «план» from checklist where possible.
2. Shorten day-1 coachmarks: `onboarding.coachLiveLogging`, `home.firstWorkoutHint`, `onboarding.coachRecordsEmpty` (no English «live» in RU).
3. Replace cryptic live labels: `live.weightBw` («Доп.»), `live.pickAlternative`, `live.fillColumnHint` (defer tip until 2nd session or after first set).
4. Empty states: one sentence + one CTA; remove feature dumps.
5. Delete or wire dead `home.*` keys so writers do not maintain ghosts.

### P1 - Onboarding comfort (UX)

1. Demo path as default primary on empty Home («Попробовать демо» visual weight ≥ Create).
2. After demo install: auto-open preview with single coachmark «Нажмите Старт».
3. Live first session: hide or collapse set-kind chips until first finish (or coachmark once after setLogged).
4. Summary: keep guest sync soft; add one-line «Что дальше: откройте Тренировки».
5. Auth help: 3 bullets matching checklist language, link to demo if not done.

### P2 - Polish

1. FirstWinToast on first set / first finish (quiet, dismissible).
2. Remaining live coachmarks from plan §6.7 (one at a time).
3. RU/EN parity pass on asymmetric keys (`records.edit`, `summary.volume`).
4. 3 novice hallway tests (phone in gym lighting).

---

## 5. Kimi prompt (copy-paste)

```text
You are a senior UX writer for Repdraft, a calm gym workout logger (PWA). Audience: athletes logging sets on a phone in the gym, often one-handed. Product mantra: improve the experience, not the feature count. Sacred loop: Open → Pick workout → Preview → Start → Set → Weight × reps → Next → Finish → Saved.

VOICE
- Short, direct, calm. No hype, no guilt, no AI-coach poetry.
- Buttons: verb + outcome (max ~4 words).
- Coachmarks / empty states: max 2 short sentences; one next action.
- RU is primary; EN must match meaning and length, not literal translation.
- Forbidden in user-facing copy: em-dash, en-dash as punctuation; filler (elevate, seamless, unleash); English jargon inside RU (live, PR as English letters if avoidable - use «личный рекорд»).
- Use «тренировка» for the plan the user starts; «сессия» / «история» for finished workouts; «подход» for a set.

TASK
1) Rewrite the strings below as RU + EN pairs.
2) Keep placeholders like {name}, {n}, {min} unchanged.
3) Prefer deletion of fluff over cleverness.
4) Flag any string that should be removed as unused or deferred past first session.
5) Output a markdown table: key | RU | EN | note (optional).

CONSTRAINTS
- Do not invent new product features.
- Do not add social / streaks / AI coaching copy for first-run surfaces.
- Onboarding must push time-to-first-completed-set, not account signup.

CONTEXT - CURRENT PROBLEMS
- Checklist says «план» while UI says «тренировка».
- First live coachmark teaches power-user column fill too early.
- RU uses «live-сессий»; beginners see «Дроп», «В отказ», «Доп.» without context.
- Some empty/coachmark strings are feature dumps, not next steps.

STRINGS TO REWRITE
(paste keys + current RU/EN from messages.ts - start with onboarding.* and home.firstWorkout*, live.* hints, builder.groupHint, summary.guestSync*, empty states)

ALSO PROPOSE (short bullets only)
- Ideal first-session script for a guest who taps «Попробовать демо» (max 6 steps, user-visible words only).
- Which live tips to show on session 1 vs session 2+.
```

**How to feed Kimi:** export a slice of `src/lib/i18n/messages.ts` (onboarding + home + live + summary + empty). Paste into the STRINGS section. Ask for a second pass on EN after RU is locked.

---

## 6. Suggested implementation slices (engineering)

| Slice | Scope | Branch idea |
|-------|--------|-------------|
| A | P0 copy only in `messages.ts` + changelog | `cursor/v0.17.4-copy-sacred-loop` |
| B | Demo CTA weight + first-session live simplification | `cursor/v0.18.0-onboarding-comfort` |
| C | FirstWinToast + remaining coachmarks | patch/minor after B |

Do not ship a full messages rewrite in one PR - review RU on a real phone mid-set.

---

## 7. Acceptance checks

- Guest cold start → demo → first set ≤ ~3 min (manual).
- No English product jargon in RU coachmarks on day 1.
- Checklist language matches Home/Workouts labels.
- `npm run check` after i18n edits; e2e `onboarding-guest-demo` still green.
- Spot-check EN for length overflow on 390px buttons.
