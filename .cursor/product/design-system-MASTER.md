# Repdraft design system (MASTER)

Source: ui-ux-pro-max analysis (2026-09) + product north star (`GOAL.md`, `.cursorrules`, `mvp.mdc`).

## Product

- Fitness workout PWA (SvelteKit). Sacred loop first: open → pick → train → finish.
- Mobile / weak-device first. Improve experience, not feature count.
- No gamification / social / charts unless explicitly requested.

## Pattern

- Minimal single column, one primary CTA per screen.
- Bottom sheets over centered modals.
- Skeletons / optimistic UI; no blocking full-screen loaders.
- Touch targets ≥ 48×48px (`--control-height`).

## Style (locked)

- **Dark OLED minimal** + short micro-interactions (press ~150–200ms).
- Do **not** adopt “fitness energy orange” palettes from generic kits.
- Lucide icons only in chrome. No emoji as UI icons.

## Colors (keep)

| Role | Token / value |
|------|----------------|
| Background | `--color-bg` `#0b0b0c` (dark) / `#f2f2f7` (light) |
| Ink | `--color-ink` |
| Accent | `--color-accent` `#8b5cf6`, fill `#7c3aed` |
| Surfaces | `#1c1c1e` / `#2c2c2e` (dark) |

**Anti-pattern:** rebrand to `#F97316` orange + green CTA.

## Typography

- Face: **Inter Variable** (latin + cyrillic), loaded via `fonts.css`.
- Tokens: `--font-display`, `--font-body`.
- Optional future upgrade: DM Sans / Satoshi only with RU coverage check.

## Motion

- Brand splash: short beam while boot is up; `MIN` splash timing in `app.html`.
- Header BrandMark calm: sparse cycle (~8s), paused off-screen / hidden tab.
- Always respect `prefers-reduced-motion`.

## Theme

- **Default: dark** (`DEFAULT_APP_THEME`). User can switch to light in Profile / chrome.
- Existing `localStorage` / cookie theme wins over default.

## A11y

- `:focus-visible` rings on buttons, links, fields (accent outline).
- Never remove outline without a visible replacement.
- Decorative brand SVGs: `aria-hidden`.

## Stack notes

- SvelteKit + Tailwind tokens in `src/lib/styles/blocks/tokens.css`.
- Offline-first stores; do not invent React Query patterns.
