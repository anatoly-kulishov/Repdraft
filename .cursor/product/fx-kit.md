# FX kit (libraries.dev cousins)

Own Svelte 5 / CSS takes on all nine [libraries.dev](https://libraries.dev/) effects, **without** their React/npm packages or `three`. Web only; RN does not use them.

| Effect | Export | Product surfaces |
|---|---|---|
| Border beam | `BorderBeam` | Guest home; `/ai` plan + skeleton (card only — the composer field keeps a static neon glow, the traveling ring read as a stray blob at the corners); empty states; onboarding; coach cards; clients invite; progress workouts card |
| Thinking orbs | `ThinkingOrbs` | `/ai` generate/listen; builder AI tune; recognize program |
| Liquid gooey | `LiquidGooey`, `GooeyMorph` | `/ai` examples; builder AI goals; catalog targets; progress period tabs; morph lab-only |
| Liquid metal | `MetalFx` / Text / Badge, `.fx-cta-sheen` | Text/badge + optional sheen on hover. CTA metal ring off (looked like a harsh border on press). Empty/plans CTAs are plain buttons |
| Image generation | `ImageFx` | lab only (lists keep native fade) |
| Distortion waves | `WaveSwap` | `/ai` busy→plan; builder AI tune |
| Magnetic UI | `magnetic()` | Lab only (`/lab/fx`) |
| Voice position | `VoicePosition` | lab only |
| Voice ring | `.fx-voice-ring` | `/ai` mic while dictating |
| Bot avatars | `BotAvatar` | `/ai` status badge; summary hero (happy) |

- Code: `src/lib/components/fx/`, styles `src/lib/styles/blocks/fx.css`.
- `.fx-gooey__items` is only `display: flex` + gap: the caller's items class owns layout. Chip strips (`catalog-filter-chips` on catalog zones and `/ai` examples) keep `flex-wrap: nowrap` + `overflow-x: auto`; wrapping rows say so themselves (`.builder-ai-tune__goals`), progress period tabs switch to grid. Don't put `flex-wrap: wrap` back on the wrapper: `fx.css` loads last and would stack every chip strip into rows.
- Chip strips also set `overflow-y: hidden`. `overflow-x: auto` alone computes `overflow-y: auto`, so the row becomes a vertical scroller: a vertical swipe on iOS rubber-banded the chips out of their box while the gooey blob (a sibling of the strip) stayed put. Never let chip hit-areas (`::after`) poke past the strip box either - keep that padding inside the strip (`/ai` chips do `padding-block` + negative `margin-block`), otherwise the extra pixels become vertical scroll range.
- Summary hero and exercise media keep no beam: the ring had no padding to breathe and read as a stray border.
- Sheets: `BottomSheet` variants are `raised` (floating card, centred) and `flush` (web-only opt-in: full-bleed card sitting on the viewport edge, home-indicator inset inside the card, lifts above the keyboard via `--vv-keyboard-inset`). Recognize program uses `flush`; the plan tune sheet too. Both put one loud primary CTA and keep the rest quiet (outlined/divider + text button).
- `WaveSwap` is not the right swap for two text layouts: a moving edge leaves both copies readable at once (form chips under diff rows), which reads as a glitch. `PlanTuneSheet` uses fade-through instead (out 110 ms, then in 300 ms with an 8 px rise, host height animated); keep the wave for image/illustration swaps.
- Gotcha: `WaveSwap` (`.fx-wave`) clips with `overflow: hidden` and no radius, so an *outside* BorderBeam glow inside it gets cut square and fills the card corners. Keep `pulse-inner` inside a wave, or give the wave `border-radius` matching the card.
- Perf: pause offscreen / hidden tab. `magnetic()` fine-pointer only.
- Honors `prefers-reduced-motion` and the in-app **Reduce motion** toggle (`data-reduce-motion`, Interface settings).
- QA gotcha: headless WebKit in Playwright does **not** paint `backdrop-filter`, so a sheet looks see-through there even though real Safari (and Chromium) blurs it. Judge sheet opacity in Chromium; use WebKit only for layout/gesture checks.
- Sandbox: `/lab/fx` (dev only, 404 in prod).
- Skip live set logging UI: sacred loop stays quiet and fast.
