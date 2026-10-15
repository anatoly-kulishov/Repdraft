---
name: release-gate
description: >-
  Pre-release gate for Repdraft. Use when the user says release gate, релиз-гейт,
  готовность к релизу, pre-release, перед релизом, release check, or asks to
  verify the app is ready to ship. Runs checks, QA matrix, code review, READY/NOT READY verdict.
disable-model-invocation: true
---

# Release Gate (Repdraft)

**Trigger:** `release gate` · `релиз-гейт` · `готовность к релизу` · `pre-release` · `перед релизом`

Полный прогон перед merge/release. North star: sacred loop (open → pick → preview → train → set → finish → saved). См. `.cursorrules`, `mvp.mdc`, `release-branches.mdc`.

## 1. Release hygiene

- Сверь `git tag --sort=-v:refname | head -1` / `gh release list` с `package.json` `version` и именем ветки (`feat/vX.Y.Z-slug` → `"version": "X.Y.Z"`).
- Diff ветки vs `main`: только ожидаемые изменения, без `.env`/секретов, без мусора.
- `npm run build` - exit 0.

## 2. Автопроверки (все зелёные или явный skip с причиной)

```bash
npm run check
npm run check:mobile
npm run build
```

Playwright / domain selfchecks удалены из репо. Регрессии sacred loop - ручной QA (§4) и typecheck.

## 3. Code review (блокеры)

- Слои: `domain` чистый, UI не лезет в `storage` напрямую.
- MVP: touch ≥48px, skeletons не блокеры, offline-first, одна primary CTA на экран.
- i18n: `translate()`, без em-dash в UI.
- URL/SEO: `/exercises/saved`, `/exercises/records`, `/privacy`, `/terms`, redirects, sitemap, robots.
- Legal: signup/magic consent; real `PUBLIC_PRIVACY_*` before public/store (no placeholders).
- Delivery: RN (`mobile/`) + web/PWA; без Capacitor.

При сомнениях - `/auditor review diff before release`.

## 4. Ручной QA - матрица

**Viewports:** 390 mobile · 768 tablet · 1280 desktop (web). **Тема:** dark (основная) + spot-check light. **Роли:** guest + logged-in где релевантно.

**Web экраны (минимум):**

`/ · /workouts · /workouts/[planId] · /live/[planId] · /builder · /exercises · /catalog/all · /catalog/[zone] · /exercise/[id] · /exercises/saved · /exercises/records · /auth · /privacy · /terms`

**RN (Expo):** Home → plan preview → Start → set (weight×reps) → Next → Finish → history; builder reorder/sets; profile sync.

На каждом: skeleton → контент без layout jump, back/nav, search/filters, empty states.

**Auth legal:** signup + magic link show Terms/Privacy consent; submit disabled until checked; guest profile links to `/terms` + `/privacy`.

**Sacred loop:** pick → preview → start → set (weight×reps) → next → finish → result saved (web + RN).

**History detail (P0):** delete + undo + edit save persist.

**Edge cases:**

- offline / slow network - мутации local-first
- пустые списки, 1 элемент, длинные названия/заметки (`NOTE_MAX`)
- swipe-to-delete (mobile)
- deep links `?from=`, redirect `/records` → `/exercises/records`
- keyboard на live (вес/повторы)
- safe-area, tabbar, bottom CTA не перекрыты

Skill `responsive-testing` - для UI-изменений в ветке.

## 5. Вердикт (обязательный формат)

```markdown
### RELEASE STATUS: READY | NOT READY

**Blockers (P0):** …
**Warnings (P1):** …
**Проверено:** [команды] + [экраны/viewports]
**Версия:** vX.Y.Z · package.json совпадает: да/нет
**Рекомендация:** merge | hold | patch first
```

`NOT READY` - не релизить, пока P0 не закрыты.

После `READY` - по запросу пользователя: commit, PR, GitHub Release (см. `release-branches.mdc`).
