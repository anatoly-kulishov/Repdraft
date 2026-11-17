# FX kit (libraries.dev cousins)

Own Svelte 5 / CSS takes on all nine [libraries.dev](https://libraries.dev/) effects, **without** their React/npm packages or `three`. Web only; RN does not use them.

| Effect | Export | Product surfaces |
|---|---|---|
| Border beam | `BorderBeam` | Guest home hero; AI plan card |
| Thinking orbs | `ThinkingOrbs` | `/ai` generate/listen; builder AI tune; recognize program |
| Liquid gooey | `LiquidGooey`, `GooeyMorph` | `/ai` example chips; builder AI goals; catalog target chips; morph lab-only |
| Liquid metal | `MetalFx`, `MetalText`, `MetalBadge`, `.fx-cta-sheen` | Guest CTA; `/ai` generate / add to builder; AI tune; recognize CTAs |
| Image generation | `ImageFx` | lab only (avoid long lists) |
| Distortion waves | `WaveSwap` / `waveReveal` | `/ai` busy→plan; builder AI tune form→result |
| Magnetic UI | `magnetic()` | Desktop: guest CTA, `/ai` primary CTAs |
| Voice position | `VoicePosition` | lab only |
| Bot avatars | `BotAvatar` | `/ai` status badge (idle / thinking / talking / happy) |

- Code: `src/lib/components/fx/` (barrel `index.ts`), styles `src/lib/styles/blocks/fx.css`.
- Hosts keep their own radius; rings inherit. `MetalFx` takes `radius` (default `--radius-button`).
- Perf: CSS/canvas pause offscreen and on hidden tabs. `magnetic()` only on fine pointers.
- Honors `prefers-reduced-motion`.
- Sandbox: `http://localhost:5173/lab/fx`, **dev only** (404 in prod builds).
- Do not sprinkle across every sacred-loop screen; prefer AI and one primary CTA per view.
