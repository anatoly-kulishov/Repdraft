# Agent Skills — Repdraft

## Project skills (`.cursor/skills/`)

| Skill | Триггер | Назначение |
|-------|---------|------------|
| `release-gate` | **`release gate`**, `релиз-гейт`, `готовность к релизу`, `pre-release` | Полный прогон перед релизом → READY / NOT READY |
| `responsive-testing` | UI/layout изменения | Visual QA 375/390px |
| `grinding-until-pass` | fix until green | check → domain → e2e loop |
| `suggesting-cursor-rules` | повторяющаяся ошибка | Новое правило в `.cursor/rules/` |

## Project skill

| Skill | Path | Когда |
|-------|------|-------|
| `repdraft` | `.agents/skills/repdraft/SKILL.md` | Любая работа в этом репо |

Cursor подхватывает skill автоматически, когда **корень workspace** = этот репозиторий.

## Проверка

```bash
chmod +x scripts/install-agent-skills.sh
./scripts/install-agent-skills.sh
```

Затем **Developer → Reload Window** в Cursor.

## Agent Ecosystem

Полная карта subagents + MCP + skills: [`docs/agent-ecosystem.md`](agent-ecosystem.md).

## MCP (project)

`.cursor/mcp.json`:

- **playwright** — E2E и browser automation
- **supabase** — read-only, OAuth через Cursor (Settings → Tools & MCP)

## Global skills (на Mac пользователя)

Общие skills: `~/.agents/skills/` (~19 шт). Рекомендуемые для repdraft:

- `supabase`, `supabase-postgres-best-practices`
- `playwright-cli`
- `vercel-cli-with-tokens`, `vercel-optimize`
- Universal: `code-review`, `diagnosing-bugs`, `tdd`, …

User Skills tab (7): `21st-*`, `design-taste-frontend`, `getdesign`, `web-design-guidelines` — в `~/.cursor/skills/`.

**Не ставить:** `agent-browser`, `find-skills`, `deploy-to-vercel`, Expo/Prisma/Firebase, Claude Code-only skills.

## Agent state

`.cursor/agent-state.json` — контекст для длинных сессий (версия, goal, key docs).

## Project rules

Дополнительный контекст (важнее generic-советов):

- `.cursor/rules/` — Supabase auth, coding conventions
- `.cursorrules` — MVP UI rules
- `GOAL.md` — sacred loop mantra
