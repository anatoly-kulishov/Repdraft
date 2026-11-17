# FX kit (libraries.dev cousins)

Own Svelte 5 / CSS takes on all nine [libraries.dev](https://libraries.dev/) effects, **without** their React/npm packages or `three`. Web only; RN does not use them.

| Effect | Export | Product surfaces |
|---|---|---|
| Border beam | `BorderBeam` | Guest home; `/ai` composer/plan/skeleton; empty states; onboarding; coach cards; clients invite; progress workouts card; summary hero |
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
- Perf: pause offscreen / hidden tab. `magnetic()` fine-pointer only.
- Honors `prefers-reduced-motion`.
- Sandbox: `/lab/fx` (dev only, 404 in prod).
- Skip live set logging UI: sacred loop stays quiet and fast.
