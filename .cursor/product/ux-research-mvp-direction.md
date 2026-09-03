# REPdraft — Product, UX Research & MVP Direction

UX-first strategy • Competitive research • Product principles • MVP guardrails

Source research (user brief). Operational north star: [`GOAL.md`](../../GOAL.md). Screen checklist: [`mvp-spec.md`](mvp-spec.md).

---

## Executive summary

REPdraft should not try to win by having the most features. The market already has mature products for minimalist workout logging, deep analytics, social fitness, and algorithmic programming. The strongest opportunity for the MVP is to make the **basic workout-tracking loop** exceptionally clear, fast and low-friction.

**Core hypothesis:** if a user can open REPdraft, understand what to do, log a set, continue and finish a workout with almost no cognitive friction, the product has a credible reason to exist. Only after this behavior is validated should the team seriously consider expanding functionality or investing in native iOS/Android.

---

## 1. The REPdraft mantra

**IMPROVE THE EXPERIENCE. NOT THE FEATURE COUNT.**  
**FAST ON WEAK DEVICES.**

Make the existing flow faster, clearer, simpler and calmer. No feature creep. First build the best possible MVP. Then validate it. Then earn the right to build more.

Target the gym phone people actually bring: often older, low RAM, slow CPU. Long history, media, backup import, and live logging must stay usable there. Prefer pagination, deferred work, and lean renders over “load everything now.”

**Decision rule:** before implementing anything, ask whether it makes an existing user action faster, clearer, easier, or less cognitively demanding - and whether it stays smooth on a weak device. If not, it is outside the MVP unless required for correctness.

---

## 2. Product goal

Create the most convenient possible workout logging experience using the **existing** REPdraft functionality. The application should feel like a very good digital gym notebook: professional, calm, precise and out of the way.

**Core flow:**

```text
Home → Workout → Preview → Start → Active Workout →
Log Set → Next Exercise → Finish → Summary → History
```

---

## 3. What the MVP is NOT

Not an AI coach. Not a social network. Not an analytics dashboard. Not a nutrition platform. Not a wearable ecosystem. Not a program marketplace. Not a gamification system. Not a feature catalog.

---

## 4. Competitive landscape

| Product | Role |
|---|---|
| **Strong** | Minimalist workout tracking; deliberately out-of-the-way logging |
| **Hevy** | Logging + previous values + progress + large social/feature ecosystem |
| **JEFIT** | Large library, programs, deep tracking/analytics |
| **Boostcamp** | Structured programs and coaching-oriented content |

**Strategic implication:** do not compete on feature count. Compete on **clarity and low friction**.

---

## 5. Competitive research findings

- **Strong** (“Think less. Lift more.” / workout notebook) validates the logger-first direction.
- **Hevy** previous-workout values during live logging is a high-value UX pattern when equivalent data already exists in REPdraft.
- Hevy’s expansion into graphs, social, AI, wearables is context - **not** a parity checklist for MVP.
- **JEFIT** shows breadth/analytics as its own category - optimize find/add of existing exercises, not analytical depth.
- **Boostcamp** = program discovery/coaching as a separate direction - not MVP.

---

## 6. Strategic positioning

Do **not** position as “the most powerful workout app” or “the app with the most features.”

**Potential positioning:** THE CLEANEST WAY TO LOG A WORKOUT.

**Core UX differentiator:** CALMNESS - exactly what is needed for the current action, then get out of the way.

---

## 7. The most important UX metric

**TIME FROM LOOKING AT THE PHONE → COMPLETED SET.**

Practical target: **PHONE → LOOK → TAP/TYPE → COMPLETE → PHONE DOWN.**

In testing, observe time, number of taps, hesitation and errors.

---

## 8. Active Workout — highest priority

Priority hierarchy:

1. current exercise  
2. current set  
3. weight  
4. reps  
5. complete  
6. next  

Everything else is secondary. The user should be training, not operating the app. Avoid unnecessary modals, navigation detours and tiny controls.

---

## 9. High-value UX ideas that do NOT require new features

- Use existing previous-performance data when available.
- One primary CTA per screen.
- Reduce taps: inline editing / direct completion over open → edit → confirm → close.
- Preserve context on Back; return to the relevant catalog zone when possible.
- Separate Browse mode from Workout mode.
- Mobile: one-handed use, **≥48×48px** touch targets (stricter than 44px research floor), safe areas, keyboard behavior.
- Use existing data better before adding new data.
- Autosave/resume must feel reliable and non-disruptive.
- Completed / active / error states immediately understandable.
- Empty and error states calm and actionable - no new product concepts.

---

## 10. Screen-by-screen UX direction

| Screen | Direction |
|---|---|
| **Home** | Answer “what should I do now?” One primary action. Not an analytics dashboard. |
| **Workouts** | Scannable list; clear open/start. |
| **Workout Preview** | What the workout contains + one obvious Start. |
| **Active Workout** | Most polished: large inputs, clear set state, fast complete, focused next. |
| **Workout Summary** | Confirm completion; existing saved result - no new analytics. |
| **Exercise Library** | Find fast: search/browse, compact rows. |
| **Exercise Detail** | Clear hierarchy + existing Add-to-Workout. |
| **History** | Scan and reopen past workouts with existing data. |
| **Builder** | Add / reorder / configure existing exercises; no new programming concepts. |

---

## 11. Responsive UX

- **Mobile 320–430px:** one-handed, vertical, large controls, sticky primary where useful.
- **Tablet 768–1024px:** use width without becoming desktop or oversized phone. Always test this band.
- **Desktop 1280px+:** sidebar/multi-column for scanning; readable max-widths.

---

## 12. Design language

Minimal, premium, calm, technical, focused.

Avoid fitness clichés: excessive neon, aggressive bodybuilding visuals, huge motivational slogans, decorative gradients, glow, unnecessary motion.

Light and Dark = one design system (same hierarchy/spacing/components); semantic colors change. (Current shipped UI is dark-first; keep one system if light is added.)

---

## 13. UX review checklist

- Primary action obvious within one second?
- Task completable without unnecessary screens?
- Touch targets ≥ 48×48px?
- Mobile one-handed?
- Keyboard avoid covering active input/CTA?
- Back preserve context?
- Active/completed states obvious?
- Unnecessary visual noise?
- Did this change add a feature instead of improving an existing action?
- Works at mobile / tablet / desktop?
- Can a new user complete the core flow without instruction?

---

## 14. User testing plan

Give a new user these tasks **without explaining the UI:** create a workout; start it; record the first set; continue; finish.

Observe hesitation, wrong taps, backtracking, search behavior and time-to-completion. Do not ask only whether it looks good; watch behavior.

---

## 15. MVP red flags

- User searches for the primary button.
- User loses catalog context after opening an exercise.
- User must remember previous weight/reps the app already knows.
- Multiple modals to record a set.
- Keyboard covers input or CTA.
- Active workout feels like a dashboard.
- Every list item is a heavy card.
- Multiple buttons compete as primary.
- New features because a screen “feels empty.”
- Desktop is stretched mobile; tablet ignored.
- Light and Dark become two different products.

---

## 16. Native iOS / Android decision

Native is **not** the MVP goal by itself. It is a scale decision after evidence: repeated usage, retention, preference over alternatives, and a demonstrated reason native capabilities would materially improve the experience.

---

## 17. Final product philosophy

REPdraft should feel like a really good digital gym notebook.

Not a fitness social network. Not an analytics dashboard. Not an AI coach. Not a feature catalog.

**Ideal compliment:** “I don't even think about the app. I just use it.”

---

## Research sources

- [Strong](https://www.strong.app/)
- [Hevy features](https://www.hevyapp.com/features/)
- [Hevy previous workout values](https://www.hevyapp.com/features/track-exercises/)
- [Hevy help / 2025 features](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2025-Features-Guide)
- [Hevy workout logging](https://www.hevyapp.com/features/track-workouts/)
- [Hevy gym performance](https://www.hevyapp.com/features/gym-performance/)
- [Hevy exercise library](https://www.hevyapp.com/features/exercise-library/)
- [Hevy social](https://www.hevyapp.com/features/social-features/)
- [JEFIT](https://www.jefit.com/)
- [Boostcamp](https://www.boostcamp.app/)
