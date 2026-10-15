# Watch session ownership (spike / ADR)

**Status:** spike only. Not implemented. Phase C/E after RN phone loop is stable.  
**Related:** [`native-rewrite-plan.md`](./native-rewrite-plan.md).

## Decision needed first

Pick **one** companion platform for v1 (watchOS **or** Wear OS). Do not ship Garmin in the same release.

## Ownership model (proposed)

| Role | Authority |
|------|-----------|
| Phone (RN) | Default **master** of active session id, plan id, merge/outbox |
| Watch | Can **start** or **continue** only if phone grants lease; writes sets to shared session blob |
| Conflict | Phone wins on simultaneous finish; watch sets already logged merge by set index + timestamp |

```text
Phone master session id
  → watch requests lease (planId + sessionId)
  → watch logs sets offline into local queue
  → on reconnect: push set deltas to phone storage / outbox
  → finish: phone (or watch with lease) calls finishSession; other client becomes read-only
```

## Minimum watch UI (not a shrunk phone screen)

```text
Today → exercise → weight × reps → confirm set → rest → next → finish → short summary
```

No builder, catalog search, AI, or profile on watch v1.

## Data contracts (reuse phone)

1. Same `WorkoutSession` / `LoggedSet` types in `domain`
2. Same local-first + outbox kinds when cloud is on
3. Stable ids (`isCloudPersistableId`)
4. Rest timer may run on watch; phone mirrors `restUntil` when connected
5. Kill / low battery: unsent sets stay in watch queue until sync

## Out of scope for spike

- HealthKit as session store
- Cross-platform UI abstraction before ownership protocol is written
- Simultaneous watchOS + Wear OS + Garmin

## Next engineering step

1. Write a one-page protocol (lease, heartbeat, finish race) as TypeScript types in `domain/watchSession.ts` (no native yet).
2. Prototype watchOS companion **or** Wear module against that protocol.
3. Keep Expo Go phone app unchanged; companion is a separate native target.
