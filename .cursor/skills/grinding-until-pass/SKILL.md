---
name: grinding-until-pass
description: >-
  Autonomous fix loop for Repdraft: edit → npm run check → check:domain → Playwright
  → analyze failure → fix → repeat until all pass. Use when user wants green CI,
  "fix until tests pass", or after non-trivial code changes before done.
disable-model-invocation: true
---

# Grinding Until Pass

Autonomous quality loop. Do not claim done until every step exits 0.

## Loop

```
┌─────────────┐
│ Apply fix   │
└──────┬──────┘
       ▼
┌─────────────┐     fail    ┌──────────────┐
│ npm run     │────────────►│ /debugger or │
│ check       │             │ analyze log  │
└──────┬──────┘             └──────┬───────┘
       │ pass                      │
       ▼                           │
┌─────────────┐     fail           │
│ npm run     │────────────────────┘
│ check:domain│
└──────┬──────┘
       │ pass
       ▼
┌─────────────┐     fail
│ npm run     │────────────────────┘
│ test:e2e    │
└──────┬──────┘
       │ pass
       ▼
    DONE
```

## Commands (repo root)

```bash
npm run check
npm run check:domain
npm run test:e2e
```

Optional scope when parent named files:

```bash
npm run test:e2e -- tests/e2e/sacred-loop.spec.ts
npm run test:e2e -- --project=mobile-dark
```

## Rules

1. **Max iterations:** 5 full loops; then stop and report blocker with logs.
2. **Minimal diffs** per iteration — one root cause at a time.
3. **Never** skip checks, `--passWithNoTests` hacks, or commented-out assertions.
4. **Never** disable domain selfchecks.
5. If same error repeats twice, spawn `/debugger` with full log.
6. After loop succeeds, spawn `/verifier` for independent confirmation.

## Progress log

After each iteration, append to response:

```markdown
### Iteration N
- Change: <what>
- check: pass/fail
- check:domain: pass/fail
- test:e2e: pass/fail
- Next: <action>
```

## Stop conditions

- All three commands exit 0 → success.
- 5 iterations with same failure → escalate to user with debugger report.
- Failure outside repo control (missing `.env`, dev server port conflict) → document setup step for user.
