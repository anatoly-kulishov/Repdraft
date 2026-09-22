# Inbox: AI tune sets / reps / rest (builder menu)

Captured from phone (exercise actions sheet: Ladder / Delete).  
Status: **backlog** - do not implement until sacred loop polish is clearly ahead and user explicitly asks to build.

```yaml
agent_card:
  type: idea
  status: backlog
  loop_step: outside-loop
  route: "/builder → workout-ex-head__menu → BottomSheet"
  severity: p2-edge
  device: phone (RU screenshot)
  loop_fit: no-backlog-only
  package_hint: "src/lib/components/WorkoutExerciseRow.svelte actions sheet; reuse /api/ai/* carefully"
  done_when:
    - "Sheet has one clear entry (e.g. «Подобрать с ИИ») that opens a focused chat/sheet for THIS exercise"
    - "User can accept suggested sets, reps, and/or rest into the draft row in one tap"
    - "Offline / no AI keys: entry hidden or disabled with short copy; sacred loop and builder stay usable"
    - "Does not become a Fitbod-style coach or block Save / Add"
```

## Summary

Add a third action in the builder exercise menu: AI chat/analysis to suggest sets, reps, or rest for the current exercise, then apply into the row fields.

## Problem / friction

Choosing prescription (sets × reps × rest) still needs judgment. Ladder covers progression schemes; it does not advise “what numbers fit this lifter / exercise today”.

## Proposal (rough)

1. In `WorkoutExerciseRow` BottomSheet (next to Ladder / Delete): item like «Подобрать с ИИ» or «ИИ: подходы и отдых».
2. Open a focused sheet/chat scoped to **one exercise** + current draft values + optional last session numbers.
3. Model returns suggested `sets` / `reps` / `restSec` (and short why).
4. Primary CTA: Apply → write into draft fields; Cancel leaves row unchanged.

## Sacred loop fit

- **Not** on the gym live path (Open → Set → Finish). This is **builder prep**.
- MVP docs already say: do not build AI coach like Fitbod without an explicit ask; `/ai` already covers plan draft.
- Prefer shipping only if builder prescription friction is proven; otherwise keep polishing live log.

## Scope guardrails

- Reuse existing AI stack (`AI_PROVIDER`, `/api/ai/plan` patterns) - do not add a new provider.
- One exercise at a time; no full-program rewrite from this menu.
- No blocking loaders; optimistic apply.
- i18n RU/EN; 48px targets; bottom sheet (not centered modal).

## Evidence

Screenshot: exercise actions sheet with Ladder + Delete on «Поочерёдное сгибание на бицепс со штангой».

## Related

- Product AI surface today: `/ai` (whole-plan draft), not per-row tune.
- Roadmap: [market-roadmap.md](./market-roadmap.md) → «Не делать сейчас: AI-коуч как Fitbod».
- When greenlit: bump to `ready`, branch `cursor/vX.Y.Z-builder-ai-tune`, link issue if any.
