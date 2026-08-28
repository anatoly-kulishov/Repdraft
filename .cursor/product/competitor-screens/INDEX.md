# Competitor design screenshots

Reference library for Repdraft UI/UX work. See also [reference-ui-plan.md](../reference-ui-plan.md).

**Updated:** 2026-08-28

## Sources

| Source | Strong | Hevy | FitnessOnline | Shagulin |
|--------|--------|------|---------------|----------|
| App Store (1290×2796) | ✅ 6 | ✅ 10 (`itunes-full/`) | ✅ 10 | ❌ нет в Store |
| App Store thumbs | — | ✅ 6 + 10 | — | — |
| Google Play | ❌ timeout | ❌ timeout | ❌ timeout | ❌ нет в Play |
| Marketing site | ❌ timeout | ❌ timeout | ❌ timeout | ✅ 6 |
| User captures | — | ✅ 5 | — | ✅ 2 |

Play Store и сайты `strong.app`, `hevyapp.com`, `fitnessonline.app` из этой среды не отдаются (curl/playwright timeout). При необходимости догрузить вручную с телефона или через VPN.

---

## Strong (`strong/`)

App ID: `464254577` · Package: `io.strongapp.strong`

| File | Screen / pattern |
|------|------------------|
| `appstore/appstore-00.png` | **Live log** — сессия, таблица set/previous/kg/reps, Finish, notes |
| `appstore/appstore-01.png` | **Exercise detail** — About/History/Charts/Records, видео, instructions |
| `appstore/appstore-02.png` | **Plate calculator** — modal поверх live workout |
| `appstore/appstore-03.png` | **Rest timer** — круг, ±10s, Skip |
| `appstore/appstore-04.png` | **Profile / charts** — workouts per week, best set line chart |
| `appstore/appstore-05.png` | **iOS widget** — workouts per week vs target |

**Borrow for Repdraft:** табличный log, previous column, rest timer sheet, exercise tabs (без charts overload).

---

## Hevy (`hevy/`)

App ID: `1458862350` · Package: `com.hevy`

**Full-res (prefer):** `itunes-full/itunes-00..09.png`

| File | Screen / pattern |
|------|------------------|
| `itunes-full/itunes-00.png` | Marketing — LOG WORKOUTS / GET STRONGER |
| `itunes-full/itunes-01.png` | **Log workout** — duration/volume/sets, previous, rest timer, green completed rows |
| `itunes-full/itunes-02.png` | **Exercise analytics** — heaviest weight chart, PR badge, metric pills |
| `itunes-full/itunes-03.png` | **Workout hub** — Start Empty, routines list, Start Routine CTA |
| `itunes-full/itunes-04.png` | **Social feed** — workout card, like/comment/share |
| `itunes-full/itunes-05.png` | **Body measurements** — weight chart, history list |
| `itunes-full/itunes-06.png` | **Strength comparison** — vs another user |
| `itunes-full/itunes-07.png` | **Profile / social** — follow, weekly duration chart, routines |
| `itunes-full/itunes-08.png` | **Exercise library** — search, equipment/muscle filters, row list |
| `itunes-full/itunes-09.png` | **Dark mode** — social feed variant |

**Thumbs (legacy):** `appstore/`, `itunes/` — те же кадры, низкое разрешение.

**User captures (`../user-captures/`):**

| File | Notes |
|------|-------|
| `hevy-dark-log-workout.jpg` | Live log, dark theme |
| `hevy-dark-add-exercise.jpg` | Add exercise flow |
| `hevy-dark-profile.jpg` | Profile tab |
| `hevy-light-log-workout.jpg` | Live log, light |
| `hevy-light-muscle-distribution.jpg` | Muscle heat / distribution |

---

## FitnessOnline (`fitnessonline/`)

App ID: `1114387800` (RU) · Package: `fitness.online.app`

| File | Screen / pattern |
|------|------------------|
| `appstore/appstore-00.jpg` | **Exercise catalog** — muscle group cards + search |
| `appstore/appstore-01.jpg` | **Analytics → Muscles** — body map, % per muscle |
| `appstore/appstore-02.jpg` | **Programs** — completion 100%, trophy, next level CTA |
| `appstore/appstore-03.jpg` | **Live workout** — 3D demo, reps/rest rings, Apple Watch |
| `appstore/appstore-04.jpg` | **Analytics** — weight line chart + arms donut breakdown |
| `appstore/appstore-05.jpg` | **Plan preview** — exercise rows, progress %, НАЧАТЬ ТРЕНИРОВКУ |
| `appstore/appstore-06.jpg` | **Progress** — weight/reps chart + workout calendar |
| `appstore/appstore-07.jpg` | **Exercise detail** — tabs Инфо/Мышцы/История, numbered steps |
| `appstore/appstore-08.jpg` | **Messages** — AI assistant + trainer chat |
| `appstore/appstore-09.jpg` | **Filters** — location/muscles/equipment chips sheet |

**Borrow for Repdraft:** preview rows, muscle summary on hero, tabbed exercise detail (без social/diet/AI scope).

---

## Shagulin (`shagulin/`)

Site: [shagulin.com](https://shagulin.com/) · Package: `com.shagulin.app` (APK, не в публичном Play/App Store)

| File | Screen / pattern |
|------|------------------|
| `site-00.jpg` | **Program preview** — day tabs, warm-up + workout list, supersets, СТАРТ |
| `site-01.jpg` | Marketing photo (trainer) |
| `site-02.jpg` | Before/after transformation |
| `site-03.png` | **Exercise video** — technique overlay text |
| `site-04.png` | *(small — check if icon/asset)* |
| `site-05.png` | *(small — check if icon/asset)* |
| `play-store-og.jpg` | OG/thumb from aggregator |

**User captures:**

| File | Notes |
|------|-------|
| `shagulin-dark-home.jpg` | Home / program hub |
| `shagulin-dark-live-exercise.jpg` | Live exercise screen |

**Borrow for Repdraft:** program day structure, superset visual, dark premium shell, video technique overlay.

---

## Naming convention

```text
{app}/
  appstore/   or itunes-full/   — App Store screenshots (00 = first in listing)
  play-store/                   — Google Play (when available)
  site/                         — marketing site captures
../user-captures/               — real device screenshots from team
```

## Manual gap-fill (optional)

1. Google Play: `io.strongapp.strong`, `com.hevy`, `fitness.online.app`
2. Sites: `strong.app`, `hevyapp.com/features/*`, `fitnessonline.app/ru/`
3. Shagulin: screenshots from APK / Telegram mini-app if available
