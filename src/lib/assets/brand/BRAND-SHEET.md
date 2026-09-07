# REPdraft — logo assets (pulse RP)

Source of truth: `app-icon-master-pulse.png` → `npm run icons:pwa` (`scripts/generate-brand-icons.mjs`).

In-app chrome (`BrandMark`, boot splash, `icon.svg`) shares `MARK_INSET` from that script. PWA “any” icons use a mild center zoom so RP stays readable at home-screen sizes.

## Mark
- White italic **RP** with heartbeat cutout through the mid stroke
- Plate: violet gradient `#8b5cf6` → `#a78bfa` → `#c4b5fd` (matches `--color-accent`)

## Files
| File | Role |
|------|------|
| `app-icon-master-pulse.png` | Full-bleed master |
| `mark-pulse.png` | White mark on transparent (512), used by `BrandMark` |
| `mark.svg` / `app-icon-*.svg` | SVG wrappers (gradient + mark image) |
| `lockup-*.svg` | Wordmark lockups |

## Static (cache-busted `-v3`)
`/icon-192-v3.png`, `/icon-512-v3.png`, `/icon-maskable-512-v3.png`, `/apple-touch-icon-v3.png`, `/favicon.ico`, `/icon.svg`, `/brand-mark-pulse.png`
