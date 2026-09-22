# Agent inbox (GitHub Issues)

Phone → GitHub Issue → Cursor agent → branch / PR in Repdraft.

Local backlog files (when Issues are not used yet) live under `.cursor/product/ideas/`.

## Active backlog files

| File | Topic | Status |
|------|--------|--------|
| [ideas/builder-ai-tune-prescription.md](./ideas/builder-ai-tune-prescription.md) | Builder menu: AI suggest sets/reps/rest | backlog |

## Capture (human, phone)

1. GitHub app → **Repdraft** → **New issue**.
2. Pick template:
   - **Inbox (phone dump)** - default from the gym. Messy text + screenshot.
   - **Bug** - when you already know it is broken.
   - **Idea / UX polish** - comfort or feature thought.
3. Attach screenshot in the issue (camera roll / paste).
4. Leave title rough (`[inbox] next button dead`).

Labels you will see: `inbox`, `bug`, `enhancement`, `needs-triage`, `ready`, `blocked`.

**One-time setup (you, in GitHub UI):** create these labels if missing (Settings → Labels → New label):

| Name | Color | Description |
|------|-------|-------------|
| `inbox` | `#0E8A16` | Raw phone dump awaiting triage |
| `needs-triage` | `#FBCA04` | Needs Agent card rewrite |
| `ready` | `#1D76DB` | Agent card filled, ok to implement |
| `blocked` | `#B60205` | Waiting on human answer |

`bug` and `enhancement` already exist. Until custom labels exist, title prefixes `[inbox]` / `[bug]` / `[idea]` are enough for the agent to find issues.

## Hand to agent (human → Cursor)

Any of these prompts:

- `оформи inbox` / `triage inbox` - list open `inbox` + `needs-triage`, rewrite into Agent card format.
- `оформи issue #12` / `triage #12` - one issue.
- `сделай issue #12` / `implement #12` - execute a `ready` issue (or triage then implement).

## Agent card (canonical body)

After triage, the issue body **must** start with this fenced block so agents can parse it:

```yaml
agent_card:
  type: bug | idea | ux-polish
  status: ready | blocked | backlog
  loop_step: open | pick-workout | preview | start | set | weight-reps | next | finish | saved-result | outside-loop
  route: "/path-or-ScreenName"
  severity: p0-blocks-set | p1-friction | p2-edge
  device: "iPhone 12 PWA ru" # or unknown
  loop_fit: yes-clearly | maybe | no-backlog-only # ideas
  package_hint: "src/routes/... or component name if known"
  done_when:
    - "Concrete check 1"
    - "Concrete check 2"
```

Then keep human sections:

```markdown
## Summary
One sentence.

## Repro
1. ...

## Expected
...

## Actual
...

## Evidence
Screenshots / links already on the issue.

## Notes
Raw phone dump preserved below if useful.

## Raw dump
...
```

## Agent triage rules

1. Read issue + images (`gh issue view N` / PR context).
2. Map to sacred loop; if outside loop and not P0, mark `backlog` and stop unless asked.
3. Fill **Agent card**; set label `ready` (remove `inbox` / `needs-triage`) or `blocked` with one blocking question.
4. Do **not** invent product scope beyond the note. Prefer polish over new features.
5. On `implement #N`: branch `cursor/vX.Y.Z-slug`, follow `.cursorrules`, `npm run check`, commit, PR linking `Fixes #N`.

## Why GitHub Issues

- Phone capture + images work.
- Durable across chats.
- `gh issue list/view` works in Cloud Agent.
- Templates keep fields the agent needs without forcing perfect writing in the gym.
