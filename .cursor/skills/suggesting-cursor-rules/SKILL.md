---
name: suggesting-cursor-rules
description: >-
  When the user corrects the same mistake twice (e.g. Svelte 4 syntax, domain layer
  violations, MVP scope creep), draft a focused .cursor/rules/*.mdc rule. Use after
  repeated corrections or when user says "remember this" / "add a rule".
disable-model-invocation: true
---

# Suggesting Cursor Rules

Turn repeated corrections into durable project rules.

## Trigger

- User corrected the **same class of mistake twice** in one or across sessions.
- User explicitly asks to "add a rule" or "remember this forever".
- Verifier/debugger flagged the same violation type repeatedly.

## Algorithm

1. **Extract pattern** — what went wrong (not the one-off typo).
   - Example: used `$:` instead of Svelte 5 `$derived`.
   - Example: added `fetch` inside `src/lib/domain/`.
   - Example: second primary CTA on live screen.

2. **Check existing rules** — read `.cursor/rules/*.mdc` and `.cursorrules`. Do not duplicate; extend or reference.

3. **Draft rule** — one concern per file. Prefer `.cursor/rules/<topic>.mdc`:

```markdown
---
description: <when agent should load this rule>
globs: src/**/*.svelte   # optional, scope to relevant files
alwaysApply: false
---

# <Title>

## Do
- …

## Don't
- …

## Example
<minimal good vs bad snippet>
```

4. **Keep it short** — under 40 lines. Agents ignore bloated rules.

5. **Propose to user** — show diff preview; create file only if user confirms OR they said "add a rule".

## Repdraft rule buckets (file name hints)

| Pattern | Suggested file |
|---------|----------------|
| Svelte 5 / TS | `svelte-ts.mdc` (extend existing) |
| domain purity | `architecture.mdc` (extend existing) |
| Sacred loop / UI | `mvp.mdc` |
| Supabase auth | `supabase-auth.mdc` (extend existing) |
| Release/git | `release-branches.mdc` |

## Also persist decisions

For architectural agreements (not syntax), append to `.cursor/agent-state.json`:

```json
"decisions": [
  {
    "date": "2026-09-01",
    "topic": "…",
    "decision": "…",
    "rationale": "…"
  }
]
```

## Output

```markdown
## Suggested rule: `.cursor/rules/<name>.mdc`

**Pattern detected:** …
**Proposed rule:** …
**Create?** Awaiting confirmation / Created.
```
