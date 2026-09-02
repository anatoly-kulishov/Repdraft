#!/usr/bin/env bash
# Validates repdraft agent infra; Cursor loads .agents/skills/ and .cursor/skills/ from repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.agents/skills/repdraft/SKILL.md"
MCP="$ROOT/.cursor/mcp.json"
AGENTS_DIR="$ROOT/.cursor/agents"

[[ -f "$SKILL" ]] || { echo "Missing $SKILL" >&2; exit 1; }
[[ -f "$MCP" ]] || { echo "Missing $MCP" >&2; exit 1; }
for agent in verifier debugger auditor; do
  [[ -f "$AGENTS_DIR/${agent}.md" ]] || { echo "Missing $AGENTS_DIR/${agent}.md" >&2; exit 1; }
done
for skill in responsive-testing grinding-until-pass suggesting-cursor-rules release-gate; do
  [[ -f "$ROOT/.cursor/skills/${skill}/SKILL.md" ]] || { echo "Missing .cursor/skills/${skill}/SKILL.md" >&2; exit 1; }
done
echo "OK: repdraft project skill at .agents/skills/repdraft/"
echo "OK: 3 subagents in .cursor/agents/"
echo "OK: 4 project skills in .cursor/skills/"
echo "OK: MCP config at .cursor/mcp.json"
echo "Open repdraft as workspace root in Cursor, then Developer → Reload Window."
