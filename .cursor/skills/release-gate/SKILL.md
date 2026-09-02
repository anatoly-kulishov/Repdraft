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

Полный прогон перед merge/release. North star: sacred loop (open → pick → preview → train → set → finish → saved). См. `GOAL.md`, `.cursorrules`, `mvp.mdc`, `release-branches.mdc`.

## 1. Release hygiene

- Сверь `git tag --sort=-v:refname | head -1` / `gh release list` с `package.json` `version` и именем ветки (`cursor/vX.Y.Z-slug` → `"version": "X.Y.Z"`).
- Diff ветки vs `main`: только ожидаемые изменения, без `.env`/секретов, без мусора.
- `npm run build` — exit 0.

## 2. Автопроверки (все зелёные или явный skip с причиной)

```bash
npm run check
npm run check:domain
npm run build
npm run smoke:catalog-hub
npm run test:e2e
```

**History detail (P0, mutation actions)** — отдельный прогон в составе `test:e2e`, при правках `/workouts/history/[id]` гонять явно:

```bash
npm run test:e2e:history
```

Покрытие `tests/e2e/history-detail.spec.ts`:

- **delete** — bottom sheet подтверждение → запись исчезает, редирект на `/workouts?tab=history`
- **delete undo** — snackbar «Отменить» восстанавливает запись и возвращает на detail
- **edit save** — правка веса → «Сохранить» → toast + persist в `localStorage`

Новые destructive / persist actions на экранах — добавлять в e2e по тому же шаблону (helper seed → action → assert storage/navigation), не полагаться только на skeleton/visual.

При UI/CSS изменениях в ветке — дополнительно:

```bash
npm run e2e:ui
npm run e2e:overflow
```

Падает — почини в ветке, перезапусти до зелёного. Snapshots обновляй только осознанно: `npm run test:e2e:update`.

## 3. Code review (блокеры)

- Слои: `domain` чистый, UI не лезет в `storage` напрямую.
- MVP: touch ≥48px, skeletons не блокеры, offline-first, одна primary CTA на экран.
- i18n: `translate()`, без em-dash в UI.
- URL/SEO: `/exercises/saved`, `/exercises/records`, redirects, sitemap, robots.

При сомнениях — `/auditor review diff before release`.

## 4. Ручной QA — матрица

**Viewports:** 390 mobile · 768 tablet · 1280 desktop. **Тема:** dark (основная) + spot-check light. **Роли:** guest + logged-in где релевантно.

**Экраны (минимум):**

`/ · /workouts · /workouts/[planId] · /live/[planId] · /builder · /exercises · /catalog/all · /catalog/[zone] · /exercise/[id] · /exercises/saved · /exercises/records · /auth · /privacy`

На каждом: skeleton → контент без layout jump, back/nav, search/filters, empty states.

**Sacred loop E2E:** pick → preview → start → set (weight×reps) → next → finish → result saved.

**History detail E2E (P0):** `npm run test:e2e:history` — delete + undo + edit save (см. §2).

**Edge cases:**

- offline / slow network — мутации local-first
- пустые списки, 1 элемент, длинные названия/заметки (`NOTE_MAX`)
- swipe-to-delete (mobile)
- deep links `?from=`, redirect `/records` → `/exercises/records`
- keyboard на live (вес/повторы)
- safe-area, tabbar, bottom CTA не перекрыты

Skill `responsive-testing` — для UI-изменений в ветке.

## 5. Вердикт (обязательный формат)

```markdown
### RELEASE STATUS: READY | NOT READY

**Blockers (P0):** …
**Warnings (P1):** …
**Проверено:** [команды] + [экраны/viewports]
**Версия:** vX.Y.Z · package.json совпадает: да/нет
**Рекомендация:** merge | hold | patch first
```

`NOT READY` — не релизить, пока P0 не закрыты.

После `READY` — по запросу пользователя: commit, PR, GitHub Release (см. `release-branches.mdc`).
