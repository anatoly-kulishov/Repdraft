---
name: responsive-testing
description: >-
  Visual QA and mobile ergonomics for Repdraft. Use when changing UI/layout,
  bottom bars, FABs, live workout screen, or keyboard-heavy inputs. Opens pages
  via browser MCP at 375px and 390px, screenshots, checks action buttons visibility.
---

# Visual QA & Mobile Ergonomics

Repdraft is **mobile/PWA first**. Layout changes must survive real phone viewports.

## Viewports

| Device | Width | Height | Use |
|--------|-------|--------|-----|
| iPhone SE | 375 | 667 | Minimum supported width |
| iPhone 13-15 | 390 | 844 | Default phone band |
| iPad portrait (tablet band) | 768 | 1024 | Manual / MCP spot-check |
| Desktop | 1280 | 900 | Web desktop |

## Routes to test (priority)

1. `/` - home, primary CTA
2. `/builder` - name input, pick exercise FAB
3. `/live` - **Active Workout** - weight×reps inputs, finish button
4. `/catalog/*` - scroll, exercise cards
5. `/auth` - profile, keyboard on inputs

For RN: Expo Go / simulator on Home → plan → live → finish.

## Algorithm

### With browser MCP (preferred)

1. Ensure dev server: `npm run dev` (background).
2. For each viewport (375, 390, **768**, **1280**):
   - Navigate to route under test.
   - Resize viewport to width×height.
   - Snapshot + screenshot.
   - Check:
     - Primary action visible without horizontal scroll.
     - Bottom bar / FAB not covering inputs or primary CTA.
     - Tap targets ≥ 44px effective (visual estimate from snapshot).
3. On `/live`, focus weight/reps input - verify finish/complete control still reachable.

## Fail criteria

- Primary CTA clipped or behind fixed chrome.
- Two competing primary buttons in same viewport (violates mvp.mdc: one primary CTA).
- Horizontal overflow on 375px.
- Live logging controls unreachable after input focus.

## Report

```markdown
## Responsive QA

| Route | 375px | 390px | Issues |
|-------|-------|-------|--------|
| /live | OK/FAIL | OK/FAIL | … |

Screenshots: <paths if saved>
```

Fix before marking UI task complete. Invoke `/verifier` after fixes.
