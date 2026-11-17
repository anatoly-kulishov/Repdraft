# FX kit (libraries.dev cousins)

Own Svelte 5 / CSS takes on all nine [libraries.dev](https://libraries.dev/) effects, **without** their React/npm packages or `three`. Web only; RN does not use them.

| Effect | Export | Where in product |
|---|---|---|
| Border beam | `BorderBeam` (`size`: md, sm, line, pulse-inner, pulse-outside) | Guest home hero |
| Thinking orbs | `ThinkingOrbs` (`mode`: 9 states, `size` 20/48/64) | `/ai` while generating |
| Liquid gooey | `LiquidGooey` (move), `GooeyMorph` (FAB buds into actions) | lab only |
| Liquid metal | `MetalFx` (ring), `MetalText`, `MetalBadge`, `.fx-cta-sheen` | Guest CTA, `/ai` generate |
| Image generation | `ImageFx` (shimmer + radial blur reveal) | lab only |
| Distortion waves | `WaveSwap` / `waveReveal` + `holdUnder` transitions | lab only |
| Magnetic UI | `magnetic()` attachment | lab only |
| Voice position | `VoicePosition` (WebAudio pan, distance, muffle behind) | lab only |
| Bot avatars | `BotAvatar` (`mood`: idle, thinking, talking, happy, sad) | lab only |

- Code: `src/lib/components/fx/` (barrel `index.ts`), styles `src/lib/styles/blocks/fx.css`.
- Hosts keep their own radius: fx roots never set `border-radius`; rings inherit it. `MetalFx` takes `radius` (default `--radius-button`).
- Rings sit above content with `pointer-events: none`. `MetalFx` dims when the wrapped control is disabled.
- Perf: CSS animations pause offscreen and on hidden tabs (`fxPauseOffscreen`, `[data-fx-paused]`). Orbs canvas stops rAF offscreen and caches theme colors (re-read on `data-theme` change).
- `magnetic()` runs only on fine pointers (mouse/trackpad) and never with reduced motion.
- Everything honors `prefers-reduced-motion` (static frame, no loops).
- Sandbox: `http://localhost:5173/lab/fx`, **dev only** (`+page.ts` returns 404 in prod builds).
- Do not sprinkle across live sacred-loop screens without a product reason.
