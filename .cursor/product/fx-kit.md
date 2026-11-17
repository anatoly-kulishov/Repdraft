# FX kit (libraries.dev cousins)

Local web effects inspired by [libraries.dev](https://libraries.dev/) **without** installing their React packages.

| Effect | Component | Where |
|---|---|---|
| Border beam | `BorderBeam` | Guest home hero; `/lab/fx` |
| Thinking orbs | `ThinkingOrbs` | `/ai` while generating; `/lab/fx` |
| Liquid gooey | `LiquidGooey` | `/lab/fx` (chip demo) |
| Liquid metal | `MetalFx` | Guest CTA, `/ai` generate; `/lab/fx` |
| Image reveal | `ImageFx` | `/lab/fx` (CSS morph, no `three`) |

- Styles: `src/lib/styles/blocks/fx.css`
- Preview: `http://localhost:5173/lab/fx` (`noindex`)
- Respects `prefers-reduced-motion`
- Do not sprinkle across live sacred-loop screens without a product reason

Not ported (heavier / native APIs): Distortion waves, Magnetic UI, Voice position, Bot avatars.