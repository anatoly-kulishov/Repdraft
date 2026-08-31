# Telegram UI/UX — что одолжить (v0.15.1 backlog)

Исследование для patch-релиза **v0.15.1** (`cursor/v0.15.1-telegram-patterns`).  
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

## P0 — borrow next (v0.15.1)

### 1. Snackbar polish (дожать до «как в TG»)

- [ ] Haptic tap на Undo (iOS PWA `navigator.vibrate(10)` если доступно)
- [ ] Slide-up spring чуть короче (250–320 ms), без bounce на dismiss
- [ ] Одна snackbar за раз при undo (replace, не stack)
- [ ] Light theme: лёгкая border + shadow-float (сделано частично)

### 2. List cells / density

Telegram: одна строка = одно действие, chevron справа, subtitle muted, 48px min height.

- [ ] Workout plan rows: единый vertical rhythm с exercise rows
- [ ] History rows: дата muted сверху, название ink, chevron без лишнего padding
- [ ] Settings: value справа + chevron, как TG «Settings → Privacy»

### 3. Destructive flow

TG: swipe → confirm sheet → undo snackbar. Мы близко; не хватает:

- [ ] Swipe delete на history row с тем же undo toast (если ещё не везде)
- [ ] Clear history: sheet + undo уже есть — проверить copy и timing

### 4. Search / filter bar

TG global search: sticky field, instant filter, empty «Nothing found».

- [ ] `/exercises` catalog: search focus не прыгает при coachmark dismiss
- [ ] Empty search: одна строка + CTA «Сбросить фильтр» (не простыня текста)

---

## P1 — структура и navigation

### 5. Tab bar clarity

TG: 4–5 tabs, active = filled icon + label. Repdraft tabbar уже минимален.

- [ ] Active tab: чуть сильнее contrast (не glow)
- [ ] Badge на tab только для actionable (draft count → dock, не tab)

### 6. «Пустые» экраны

TG channels empty: иллюстрация + одна primary + secondary link.

- [ ] Builder empty / workouts empty / history empty — один шаблон `EmptyState` (icon + title + desc + 1 CTA)
- [ ] Убрать дубли hint + coachmark на одном экране

### 7. Inline context actions

TG long-press menu. У нас swipe — ок для gym.

- [ ] Swipe threshold и rubber-band как iOS/TG (уже частично в `SwipeToDelete`)
- [ ] Haptic on swipe reveal (optional)

### 8. Typography rhythm

TG: 17px body, 13px secondary, semibold titles.

- [ ] Audit: `page-title` / `section-title` / muted hints — один scale token
- [ ] Coachmark / checklist: vertical center (v0.15.0 fix)

---

## P2 — не сейчас

- Chat bubbles / threads (не наш домен)
- Stories / avatars ring
- Multi-select toolbar как в TG chat edit mode
- Sticker picker patterns

---

## Метрики успеха v0.15.1

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
| **v0.15.1** | Telegram-pattern polish (этот doc), patch only |
| **v0.16.0** | Следующая user-facing minor из roadmap P1 |

Обновлять статусы чеклистов здесь после каждого shipped patch.
