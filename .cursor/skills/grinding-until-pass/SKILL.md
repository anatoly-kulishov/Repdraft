---
name: grinding-until-pass
description: >-
  Autonomous fix loop for Repdraft: edit → npm run check → check:mobile
  → analyze failure → fix → repeat until all pass. Use when user wants green
  typecheck, "fix until checks pass", or after non-trivial code changes before done.
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
│ check:mobile│
└──────┬──────┘
       │ pass
       ▼
    DONE
```

## Commands (repo root)

```bash
npm run check
npm run check:mobile
```

## Rules

1. **Max iterations:** 5 full loops; then stop and report blocker with logs.
2. **Minimal diffs** per iteration - one root cause at a time.
3. **Never** skip checks or comment out type errors to greenwash.
4. If same error repeats twice, spawn `/debugger` with full log.
5. After loop succeeds, spawn `/verifier` for independent confirmation.

## Progress log

After each iteration, append to response:

```markdown
### Iteration N
- Change: <what>
- check: pass/fail
- check:mobile: pass/fail
- Next: <action>
```

## Stop conditions

- Both commands exit 0 → success.
- 5 iterations with same failure → escalate to user with debugger report.
- Failure outside repo control (missing `.env`, port conflict) → document setup step for user.
