# Telegram UI/UX — что одолжить (v0.15.1 backlog)

Исследование для patch-релизов **v0.15.2+** (`cursor/v0.15.2-telegram-patterns`).  
Не копируем мессенджер — берём **паттерны**, которые ускоряют священный цикл и снижают тревожность при деструктивных действиях.

**Северная звезда:** [`GOAL.md`](../../GOAL.md).  
**QA flows:** [`/scenarios`](/scenarios) в приложении, источник `.cursor/product/user-scenarios.md`.

---

## Уже взяли в v0.15.0

| Паттерн Telegram | Repdraft |
|------------------|----------|
| Undo snackbar с countdown ring + action | `ToastStack` undo-snackbar, 5 сек, theme-aware |
| Bottom sheet confirm | `BottomSheet` на finish / discard / backup |
| Grouped settings rows | `ProfileSettingsRow` на `/auth` |

---

## P0 — borrow (v0.15.2 shipped)

### 1. Snackbar polish (дожать до «как в TG»)

- [x] Haptic tap на Undo (iOS PWA `navigator.vibrate(10)` если доступно)
- [x] Slide-up spring чуть короче (280 ms), без bounce на dismiss
- [x] Одна snackbar за раз при undo (`TOAST_UNDO_GROUP` / replaceGroup)
- [x] Light theme: border + shadow-float

### 2. List cells / density

Telegram: одна строка = одно действие, chevron справа, subtitle muted, 48px min height.

- [x] Workout plan rows: chevron nav, compact 48px rhythm
- [x] History rows: дата muted сверху (eyebrow), название ink, chevron
- [ ] Settings: value справа + chevron на других list screens (profile уже ок)

### 3. Destructive flow

TG: swipe → confirm sheet → undo snackbar. Мы близко; не хватает:

- [x] Swipe delete на history row с undo toast
- [x] Clear history: sheet + undo — copy и timing проверены
- [x] Swipe rubber-band + haptic on reveal

### 4. Search / filter bar

TG global search: sticky field, instant filter, empty «Nothing found».

- [x] `/exercises` catalog hub: coachmark dismiss не крадёт focus (blur)
- [x] Empty search: EmptyState + CTA «Сбросить фильтр» (catalog + workouts plans)

---

## P1 — структура и navigation (v0.15.2 shipped)

### 5. Tab bar clarity

TG: 4–5 tabs, active = filled icon + label. Repdraft tabbar уже минимален.

- [x] Active tab: сильнее contrast (`--tab-link-active-bg`)
- [x] Badge на tab только для actionable (draft count → dock, не tab)

### 6. «Пустые» экраны

TG channels empty: иллюстрация + одна primary + secondary link.

- [x] Builder empty: icon + 1 CTA через `EmptyState`
- [x] Workouts / catalog empty search через `EmptyState` + reset
- [ ] Убрать дубли hint + coachmark на одном экране (backlog)

### 7. Inline context actions

TG long-press menu. У нас swipe — ок для gym.

- [x] Swipe threshold и rubber-band в `SwipeToDelete`
- [x] Haptic on swipe reveal

### 8. Typography rhythm

TG: 17px body, 13px secondary, semibold titles.

- [x] Tokens `--type-body` / `--type-secondary` + entity rows / empty states
- [x] Coachmark / checklist: vertical center (v0.15.0 fix)

---

## P2 — не сейчас

- Chat bubbles / threads (не наш домен)
- Stories / avatars ring
- Multi-select toolbar как в TG chat edit mode
- Sticker picker patterns

---

## Метрики успеха v0.15.2

1. Undo toast не перекрывает sheet / coachmark (lift) — **done v0.15.0**
2. Manual QA: §12 onboarding + §3 sacred loop из [`/scenarios`](/scenarios) без визуальных «кривых» gap
3. Time-to-undo tap ≤ 1s после delete (snackbar уже в viewport)

---

## Референсы для ревью в Telegram

1. Delete chat → undo snackbar (эталон для нашего toast)
2. Settings → grouped list + chevron
3. Search in chats → sticky header
4. Bottom attach sheet (height, backdrop tap)
5. «Leave group» confirm — title + short body + 2 buttons (destructive secondary)

---

## Связь с semver

| Версия | Scope |
|--------|--------|
| **v0.15.0** | Onboarding + undo snackbar + QA `/scenarios` |
| **v0.15.1** | Post-onboarding polish (scenarios fix, builder counter) |
| **v0.15.2** | Telegram-pattern P0 + P1 (этот doc) |
| **v0.16.0** | Следующая user-facing minor из roadmap P1 |

Обновлять статусы чеклистов здесь после каждого shipped patch.
