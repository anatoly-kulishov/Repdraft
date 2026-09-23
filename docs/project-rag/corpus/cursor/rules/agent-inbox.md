<!-- source: .cursor/rules/agent-inbox.mdc -->
<!-- synced: 2026-09-23 -->

---
description: GitHub Issues inbox triage and Agent card format for phone dumps → Repdraft work. Read when user says inbox, triage, оформи issue, or implement #N.
alwaysApply: false
---

# Agent inbox (Issues)

Source of truth: [`.cursor/product/agent-inbox.md`](../product/agent-inbox.md).

## When user says

- `оформи inbox` / `triage inbox` → open issues with `inbox` or `needs-triage`.
- `оформи issue #N` / `triage #N` → one issue.
- `сделай issue #N` / `implement #N` → execute (triage first if no Agent card).

## Do

1. `gh issue view N` (include body; note image URLs).
2. Rewrite body with leading `agent_card` YAML fence from `agent-inbox.md`.
3. Labels: drop `inbox` / `needs-triage`; add `ready` or `blocked` (or leave backlog note).
4. Sacred loop first. Outside-loop ideas → `backlog` unless user forces.
5. Implement only when asked; link PR with `Fixes #N`.

## Agent card minimum

`type`, `status`, `loop_step`, `route`, `severity`, `done_when` (1–3 checks). Preserve raw dump under `## Raw dump`.
