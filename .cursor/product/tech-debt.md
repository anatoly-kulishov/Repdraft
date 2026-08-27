# Tech debt (вернуться позже)

Не блокирует священный цикл. Делать отдельным patch-релизом / polish-сессией, не смешивать с UX-фичами.

## Exercise technique / row head (2026-08-26)

После переноса technique bottom sheet из Каталога в Preview / History / Builder / Live остался **быстрый wiring**, не единый компонент.

**Сделано сейчас**
- Общий UI: `ExerciseTechniqueSheet.svelte`
- Каталог: sheet убран, media → `/exercise/[id]`
- Thumb → sheet, title/chevron → detail: preview, history, builder; Live на shared sheet

**Долг / рефакторинг**
1. **Один head-компонент** для строки упражнения: thumb (open technique) + body link + optional chevron/actions. Сейчас копипаста в:
   - `src/routes/workouts/[planId]/+page.svelte`
   - `src/routes/workouts/history/[id]/+page.svelte`
   - `src/lib/components/WorkoutExerciseRow.svelte`
   - (частично) `src/lib/components/live/LiveSetPanel.svelte`
2. **Убрать `display: contents` хак** (`.workout-preview-row-main`) в пользу явной сетки/сабкомпонента без хрупкого a11y/grid поведения.
3. **Единый open-state API** (props/callback или tiny store), чтобы не дублировать `technique = { id, title, hint, image }` на каждой странице.
4. **History sets layout** - при `history-exercise__sets--grid` (4+ подходов) номера/строки могут наезжать (1 и 4 на одной линии). Починить сетку отдельно от head-рефактора.
5. **CSS thumb-кнопок** - `.workout-preview-thumb-btn` / `.history-exercise__thumb-btn` / `.workout-ex-head__media-btn` свести к одному классу-токену.

**Когда возвращаться:** фраза вроде «вернёмся к рефактору КТ / technique row» или перед следующим крупным касанием этих экранов.

## Related polish (не закрыто в той же сессии)

- Shadow policy: soft float только у tabbar/FAB/dock/toast/sheets; sticky bars - border only; убрать glow у catalog `+` (если ещё остался).
- Boot splash (`#pwa-boot`): слабый antiflash; решить keep short / remove.
- Light theme contrast (muted / primary) - см. прошлый contrast audit в чате catalog polish.
- ~~CTA ink / accent hue~~ → brand green **`#8BC34A`** (= logo) + white CTA ink. Contrast soft (~2:1); accepted for brand match.
