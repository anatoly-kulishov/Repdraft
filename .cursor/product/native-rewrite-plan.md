# Repdraft: rewrite (native-first)

**Статус:** глобальный rewrite. Источник правды по направлению продукта - этот файл + [`mvp.mdc`](../rules/mvp.mdc) + [`delivery.md`](./delivery.md). Старые MVP-спеки и research-доки сняты.

**North star:** улучшить UX священного цикла, не feature count. Метрика: phone → completed set. Быстро на слабых телефонах.

| Фаза | Статус | Суть |
|---|---|---|
| A Метрики цикла | в коде | `domain/loopMetrics.ts`, снимок в профиле (tester) |
| B Opt-in Quest | в коде (PWA) | `domain/quest.ts`, toggle, summary card |
| C Часы | позже | отдельный native UI + session ownership; не RN-экран |
| D RN ядро | **активно** | `mobile/` - sacred loop, domain shared, local-first |
| E Часы + Quest native | не начат | после стабильного D |

## Обещание

Быстрая запись подхода на телефоне (позже на часах), понятный прогресс, возврат после перерыва без наказания. Рабочее имя режима: **Repdraft Quest** (opt-in).

## Архитектура

```text
PWA:  routes/components → stores → domain → storage
RN:   mobile/app → mobile/src/storage → domain (shared)
```

Священный цикл:

```text
PWA: /workouts/[planId] → /live/[planId] → /workouts/summary
RN:  / → /plan/[id] → /live/[planId] → /summary/[id]
```

### Переносить

- Модель планов / сессий / подходов / рекордов (`domain/`)
- Repo-контракты, ID, input limits
- JSON backup v1 (`exportData.ts`)
- Merge / outbox / tombstones
- UX цикла: прошлый раз, rest, одна CTA
- i18n и каталог как контент

### Не переносить как есть

- Svelte UI / stores
- `localStorage` / PWA install heuristics
- HealthKit как единственное хранилище
- Одну кроссплатформенную UI-абстракцию раньше контрактов данных
- watchOS + Wear OS + Garmin одновременно в первом релизе

## Фаза D (сейчас): RN ядро

| Часть | Решение |
|---|---|
| UI | Expo Router (`mobile/`) |
| Storage | AsyncStorage + те же ключи domain |
| Поведение | pure TS из `src/lib/domain` |
| Cloud | Supabase + outbox; local-first first |
| Web | миграция / SEO / техника, пока импорт не проверен |
| Часы | не в scope D |

В ядро: планы, прошлый раз, подходы, rest, autosave, resume, история, export. Без питания, readiness, маркетплейса программ, соцсети как центра.

## Часы (фаза C/E, кратко)

Один стек после ясности аудитории. Минимум: сегодня → упражнение → confirm set → rest → finish → короткий итог. Session ownership телефон vs часы. Offline / kill / разрядка не теряют сессию.

## Контракты между клиентами

1. Типы и merge rules в `domain`
2. `EXPORT_VERSION` / backup shape
3. Local-first, затем cloud; outbox kinds
4. Устойчивые ID (`isCloudPersistableId`)
5. Tombstones / delete reconcile
6. Master активной сессии (телефон vs часы)
7. Идемпотентность импорта и sync

## Миграция

```text
Backup → import in native → сверка → confirm → sync
```

PWA export не убирать, пока перенос не проверен на реальных тренировках.

## Вне scope без явного запроса

Четыре клиента сразу, Garmin-как-обещание, платные XP / loot / daily streaks, B2B тренер, AI-коуч как центр, RPG для сна/питания.

## Правило решений

Священный цикл не должен стать медленнее. Новые фичи не оправдываются «потому что rewrite».
