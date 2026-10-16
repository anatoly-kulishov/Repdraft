# Agent context (single home)

Всё, что нужно агентам и Cursor в этом репо, лежит здесь: **`.cursor/`**.

Корневые файлы для людей и внешних инструментов (не дублировать содержимое сюда):

| File | Role |
|------|------|
| [`AGENTS.md`](../AGENTS.md) | Короткий вход: команды + указатель сюда |
| [`.cursorrules`](../.cursorrules) | Always-on coding/UX rules (Cursor root) |
| [`NOTICE.md`](../NOTICE.md) | Media attribution |

## Layout

```text
.cursor/
  INDEX.md          ← this map
  mcp.json          ← MCP servers
  product/          ← rewrite strategy, delivery
  rules/            ← project rules (.mdc)
  skills/           ← repeatable workflows + repdraft skill
  agents/           ← verifier / debugger / auditor
```

### product/

| File | When |
|------|------|
| `native-rewrite-plan.md` | Native-first rewrite, phases, north star |
| `delivery.md` | RN + web roles |
| `exercise-rag.md` | `/ai` catalog RAG: pgvector SQL + `npm run build:embeddings` |
| `watch-session-ownership.md` | Watch companion spike: session lease / finish race |
| `rn-visual-backlog.md` | Mobile theme + visual QA findings |

### rules/

| File | When |
|------|------|
| `mvp.mdc` | Scope (always) |
| `dual-client-parity.mdc` | RN + web/PWA parity (always) |
| `architecture.mdc` | Layers (always) |
| `release-branches.mdc` | Semver / branches |
| `svelte-ts.mdc` | Svelte/TS in `src/**` |
| `supabase-auth.mdc` | Auth checklist |
| `ru-gym-names.mdc` | Catalog `name_ru` |

### skills/

| Skill | Trigger |
|-------|---------|
| `repdraft/` | Any work in this repo (stack context) |
| `release-gate/` | `release gate` / перед релизом |
| `grinding-until-pass/` | Fix until check green |
| `responsive-testing/` | UI / viewport QA |
| `ru-gym-names/` | Awkward RU exercise titles |
| `suggesting-cursor-rules/` | Same mistake twice → new rule |

### agents/

| Agent | Role |
|-------|------|
| `verifier.md` | After “done”: `check` + `check:mobile` |
| `debugger.md` | Typecheck / runtime failures |
| `auditor.md` | Security + perf before PR |

## Как читать агентам

Читай файлы **отсюда** (`.cursor/`) и корневые `AGENTS.md` / `.cursorrules`. Отдельного RAG-зеркала нет.
