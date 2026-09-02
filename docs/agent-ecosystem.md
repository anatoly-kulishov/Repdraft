# Agent Ecosystem — Repdraft

Три категории инструментария для максимальной отдачи от Cursor Agent.

## 1. Subagents — `.cursor/agents/`

Изолированные исполнители. Не засоряют основной чат длинными логами.

| Subagent | Файл | Когда | Режим |
|----------|------|-------|-------|
| **Verifier** | `verifier.md` | После «готово» — check + e2e | foreground |
| **Debugger** | `debugger.md` | Падение тестов / stack trace | foreground |
| **Auditor** | `auditor.md` | Перед PR/релизом — security + perf | background, readonly |

**Вызов:**

```text
/verifier confirm sacred loop still passes
/debugger fix failing sacred-loop.spec.ts
/auditor review diff before release
```

Или естественным языком: «Use the verifier subagent to run check and e2e».

## 2. MCP — `.cursor/mcp.json`

Прямое действие во внешних системах.

| Server | Статус | Назначение |
|--------|--------|------------|
| **playwright** | ✅ configured | Browser automation, скриншоты, e2e |
| **supabase** | ✅ configured | Read-only schema/data (OAuth в Settings → MCP) |
| **sentry** | ⬜ optional | Стэктрейсы прода — добавить при подключении Sentry |
| **datadog** | ⬜ optional | Метрики/логи стейджинга |
| **memory** | ⬜ via agent-state | `.cursor/agent-state.json` → `decisions[]` между сессиями |

### Optional: Sentry MCP (когда появится проект)

```json
"sentry": {
  "url": "https://mcp.sentry.dev/mcp",
  "headers": {}
}
```

OAuth через Cursor при первом подключении.

## 3. Project Skills — `.cursor/skills/`

Повторяемые алгоритмы (project-scoped; Cursor auto-discovers).

| Skill | Назначение |
|-------|------------|
| **release-gate** | Pre-release: checks, QA matrix, code review, READY/NOT READY (`release gate`, `релиз-гейт`) |
| **responsive-testing** | Visual QA на 375px / 390px, keyboard vs bottom bar |
| **grinding-until-pass** | Цикл: fix → check → domain → e2e до 100% green |
| **suggesting-cursor-rules** | После 2× одной ошибки → правило в `.cursor/rules/` |

Project skill (stack/context): `.agents/skills/repdraft/SKILL.md`.

Global skills: `~/.agents/skills/` (~19). User design skills: `~/.cursor/skills/` (7).

## Рекомендуемый workflow

```text
Main agent implements change
    → /responsive-testing (if UI)
    → grinding-until-pass OR /debugger (if red)
    → /verifier (must pass)
    → /auditor (background, before PR)
    → suggesting-cursor-rules (if same mistake twice)
```

## Persistence между сессиями

`.cursor/agent-state.json`:

- `goal`, `keyDocs`, `checkBeforeDone` — контекст проекта
- `decisions[]` — архитектурные договорённости (append-only)

После изменений: **Developer → Reload Window**.

См. также: [`docs/agent-skills.md`](agent-skills.md), [`AGENTS.md`](../AGENTS.md).
