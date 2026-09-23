<!-- source: .cursor/product/ideas/builder-ai-tune-prescription.md -->
<!-- synced: 2026-09-23 -->

# Inbox: AI tune sets / reps / rest (builder menu)

Captured from phone (exercise actions sheet: Ladder / Delete).  
Status: **done** - shipped on `feat/v0.19.0-builder-ai-tune`.

```yaml
agent_card:
  type: idea
  status: done
  loop_step: outside-loop
  route: "/builder → workout-ex-head__menu → BottomSheet"
  severity: p2-edge
  device: phone (RU screenshot)
  loop_fit: builder-prep
  package_hint: "BuilderAiTuneSheet; /api/ai/tune; tunePrescription.ts"
  done_when:
    - "Sheet has «Подобрать с ИИ» for THIS exercise"
    - "Apply writes sets/reps/rest into the draft row"
    - "Offline / no AI keys: entry hidden"
    - "Not a Fitbod-style coach; does not block Save / Add"
```

## Shipped

- Menu item + bottom sheet with goal chips, note, suggest, apply, one refine
- RAG v1: catalog meta + split template slot + optional embedding peers
- `POST /api/ai/tune`; availability via `GET /api/ai/plan`
