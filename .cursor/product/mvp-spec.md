# REPdraft — MVP Product & UI/UX Specification

Главный источник требований для MVP. Не придумывать новые продуктовые концепции без необходимости.

---

## Agent workflow (обязательно перед кодом)

**AUDIT CURRENT PROJECT**

1. Inspect architecture (`src/lib/domain`, `storage`, `stores`, `routes`)
2. Inspect existing routes and navigation
3. Inspect components and design tokens (`routes/layout.css`)
4. Inspect data model (`domain/types`, repositories)
5. Inspect exercise database (`static/data`, `loadExercises`)
6. Inspect workout / live session logic (`stores/live`, `domain/session`)
7. Compare with this specification
8. List what already satisfies the spec
9. List what needs to change (P0 first)
10. Only then implement — **extend, do not rewrite from scratch**

---

## Implementation audit (living)

Last reviewed: 2026-08-13 (branch v0.8.2 UX polish)

### Satisfies P0 (foundation)

| Area | Status |
|------|--------|
| Dark tokens, purple accent, Inter | Yes — `layout.css` (surface `#151517`, border `#262629`, muted `#8E8E93`) |
| Desktop sidebar + mobile tabbar (Home / Workouts / Exercises) | Yes — tabbar on `/catalog/*` browse; focused on live/builder/detail |
| Lucide icon system | Yes — `@lucide/svelte`, `LucideIcon` |
| Brand mark (no dumbbell cliché) | Yes — `src/lib/assets/brand/` |
| Plans CRUD, builder, picker | Yes — `/builder`; add exercise opens `/catalog/all` |
| Live session, autosave active workout | Yes — `live` store + `localSessionRepository` |
| Finish → summary → history | Yes — sticky Done on summary mobile; history list + detail |
| Workout preview before live | Yes — `/workouts/[planId]` → Start → `/live/[planId]` |
| Saved exercises (bookmarks) | Yes — localStorage, `/exercises/saved`, cards + detail |
| Exercise catalog (existing DB + media) | Yes — fuzzy search, RU overrides, desktop filters\|results |
| One primary CTA per screen | Yes — Home hero, Workouts New, Live Next/Finish, demoted row Starts |
| Active Workout UX | Yes — sticky Next/Finish hierarchy, rest ring, set-done secondary |

### Gaps / polish (priority)

| Item | Spec § | Notes |
|------|--------|--------|
| Home polish | 14–15 | Hero-only focus; records on `/records` |
| Exercise detail history tab | 22 | P1 — session history on detail |
| Shared WorkoutCard component | 9 | Optional refactor |
| Rest timer sound/haptics | 26–30 | P1 optional |

### Explicitly out of MVP

Analytics, charts, PR dashboards, RPE/RIR, muscle volume, social, AI, wearables — see §3 below.

---

## 1. What we build

REPdraft — create, run, and save gym workouts. **Fast path:** create plan → live session → log sets → history.

MVP: simple, fast, clear, dark/minimal, desktop + mobile.

**Criterion:** user knows the next step without a manual.

## 2. Main user flow

Open → see workouts → create → add exercises → configure sets → save → start → log weight/reps → complete sets → next exercise → finish → summary → history.

## 3. Not in MVP

Progress charts, muscle volume/recovery, RPE/RIR, advanced 1RM, AI coach/generation, nutrition, body metrics/photos, social, gamification, wearables, subscriptions, periodization, auto progression, PR dashboards.

If it doesn’t serve create → train → save → history, defer it.

## 4–6. Navigation

**Tabs:** Home, Workouts, Exercises. **Secondary:** Settings, Profile (low emphasis).

Desktop: ~180–200px sidebar. Mobile: bottom nav, no sidebar.

## 7–12. Design language

Dark / minimal / premium / productivity. Not neon gym marketing.

**Colors:** bg `#0B0B0C`, surface `#151517`, elevated `#1A1A1D`, border `#262629`, text `#F5F5F5`, muted `#8E8E93`, accent `#8B5CF6` (sparingly).

**Type:** Inter; page 28–32px/600, section 18px/600, body 14px.

**Spacing:** 4–48 scale; desktop content padding 32–48px; reasonable max-width.

**Cards:** subtle border, 12–16px radius, minimal shadow.

**Buttons:** one primary per screen; Primary / Secondary / Ghost / Destructive / Icon.

## 13–14. Icons & logo

Lucide only (House, Dumbbell, Library, Settings, UserRound, Search, SlidersHorizontal, Plus, Pencil, Trash2, ArrowLeft, Ellipsis, Check, Timer, History). Stroke ~1.8–2px, 16–20px.

Logo: geometric R / repetition; `repdraft-mark.svg`, `repdraft-logo.svg`. No dumbbells/muscles/flames.

## 15–17. Home

Not a stats dashboard. **One primary CTA.**

| State | Hero |
|-------|------|
| New user | Welcome + **Create Workout** |
| Has plans | Greeting + **Start Workout** |
| Active session | Workout in progress + progress + **Continue Workout** |

Below: **Your Workouts** (name, muscles, exercise count), **Recent Workouts** (when, duration, sets). No charts.

## 18–25. Workouts & builder

My Workouts + New Workout, search, cards (name, muscle groups, exercise count). Create workout: name, exercise list, sets × reps, add exercise, save. Picker: search-first, quick add.

## 26–35. Active workout

Most important screen. Desktop: exercise list | current exercise (sets table, last time, add set, rest). Mobile: one exercise at a time, easy switch. Log weight + reps + completed. Autosave mandatory. Optional simple rest timer.

## 36–38. Summary & history

Summary: complete, name, duration, exercises, sets, Done. History: list + detail with logged sets. No volume charts.

## 39–46. Exercise detail, empty/loading/error, responsive, a11y, motion

Minimal detail (about + history list). Helpful empty states. Skeletons. Subtle motion only.

## 47–51. Architecture & data

Audit before change. Reuse layers: domain → storage → stores → routes. MVP entities: Workout, WorkoutExercise, Set, Completed Workout session.

## 52–56. UX principles

Each screen answers “what now?”. Minimize steps during training. Minimal ≠ empty. No feature for feature’s sake.

## 57–59. Priority

**P0:** design tokens → nav → Home → Workouts → create → picker → **Active Workout** → autosave → finish → summary → history.

**P1:** exercise detail polish, previous performance, rest timer UX, empty/loading/error, a11y.

**P2:** analytics, PR, social, AI, etc.

## 60–62. Definition of done & philosophy

End-to-end flow without instructions (create → train → persist → resume → finish → history → view sets).

**Do not overengineer MVP.** Open → Pick workout → Train → Log → Finish.

---

_Full narrative spec from product owner is canonical; this file is the repo copy for agents. Update **Implementation audit** when P0 items close._
