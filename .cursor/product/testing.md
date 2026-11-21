# Web E2E: Playwright

Браузерные тесты покрывают web/PWA. React Native проверяется только типами
(`npm run check:mobile`), в браузере его не запустить.

Литеральные i18n-ключи обоих клиентов сверяет `npm run check:i18n`
(`scripts/check-i18n-usage.mjs`): `tt('...')` / `translate(lang, '...')`, которых
нет в `messages.ts`, роняют проверку, иначе ключ виден на экране. Обе проверки
входят в `npm run check:parity`.

## Запуск

```bash
npm run test:e2e:install   # один раз: скачать chromium для @playwright/test
npm run test:e2e           # build + adapter-node на :4199 + все тесты
npm run test:e2e:ui        # интерактивный режим
npm run test:e2e:report    # HTML-отчёт последнего прогона
```

Итерации без пересборки (код приложения не менялся):

```bash
E2E_SKIP_BUILD=1 npm run test:e2e
```

Тесты идут против **прод-сборки** (`npm run build` + `node build`), не против
Vite dev: так ловятся prerender/SSR/hydration-проблемы. Сервер поднимает
`scripts/e2e-server.mjs`; Playwright сам ждёт `/tools`.

## Изоляция

- Каждый тест получает свежий browser context с пустым localStorage. Состояние
  засевается через `seedLocalStorage()` (`tests/helpers/app.ts`).
- `scripts/e2e-server.mjs` **обнуляет** Supabase / AI / billing / Turnstile
  переменные, чтобы сборка не ходила в реальные сервисы. Остаётся только
  `PUBLIC_SITE_URL=https://www.repdraft.ru`, чтобы canonical/hreflang можно было
  сравнивать с прод-оригином.
- Локаль контекста фиксирована `ru-RU`; `/en/*` зеркала всё равно форсируют
  английский по URL.
- `serviceWorkers: 'block'`: SW прекеширует ~1300 превью и нужен для offline-QA,
  а E2E нужен предсказуемый HTML без кеша.
- Cookie-notice и onboarding-коучмарки закрываются в `gotoApp()`: bottom-sheet
  backdrop перехватывает клики, если его не убрать.

## Что покрыто

| Файл | Что проверяет |
|------|---------------|
| `public-content.spec.ts` | 42 публичных роута (RU + EN): 200, `<html lang>`, нет утечек i18n-ключей/`{n}`/`NaN` |
| `tools.spec.ts` | 1ПМ, калории/БЖУ, ИМТ, пульсовые зоны: математика сверена с ручным расчётом; EN-зеркало; калькуляторы ничего не пишут в localStorage |
| `programs.spec.ts` | хаб, метаданные карточек (частота, время, инвентарь), «сохранить на потом» переживает reload, 12/4 недели, старт слота, live, finish, прогресс `1 из 12` (и `Done 1 of 12`), SSR=0 vs hydration=1 |
| `sacred-loop.spec.ts` | builder draft, план, live, finish, summary, рейтинг (переживает reload), history; пустой builder ведёт в каталог |
| `builder-pick.spec.ts` | визард `/builder/equipment`: оборудование -> мышцы -> упражнения, добавление в черновик, бодивейт как запасной вариант |
| `seo.spec.ts` | self-canonical, `hreflang` ru/en/x-default, `og:locale`, 404 у плохих slug/id, robots, sitemap без дублей + выборка URL |
| `i18n-mirrors.spec.ts` | EN-хаб без ссылок на RU-контент, EN-упражнение и тост, переключение языка в профиле |
| `mobile.spec.ts` | 390×844: нет горизонтального скролла на 11 ключевых экранах |
| `cycle.spec.ts` | волна `/cycle`: интенсивность -> объём -> разгрузка, пик объёма на 2-й неделе, проценты в списке недель, состояние переживает reload |
| `shell.spec.ts` | юрфутер: ссылки на `/tools`, `/programs`, `/articles` с главной, EN-пути на `/en/*`, отсутствие в `/auth` и `/builder` |
| `theme.spec.ts` | тёмная тема: `data-theme=dark`, текст не чёрный, выбор переживает reload |
| `errors.spec.ts` | 404-страницы, публичный catalog API, AI/billing fail-closed, dev-only `/lab/fx` не в проде |

Не покрыто намеренно: реальный Supabase-логин, AI-генерация, оплата (нужны
тестовые креды и моки внешних сервисов), RN-экраны, визуальные снапшоты.

## CI

`.github/workflows/e2e.yml` запускается на каждый PR в `main` (и вручную): `npm ci`,
`playwright install --with-deps chromium`, `npm run test:e2e`, отчёт в артефакте.
Пуш в `main` по-прежнему деплоит `deploy-web.yml`; E2E в деплой не входит.

## Когда тест упал

1. `npm run test:e2e:report` открывает HTML с шагами, скриншотом и trace на retry.
2. Падение в `public-content` обычно означает реальный 500/404 или утечку ключа.
3. Если сломался селектор, сначала проверь, не изменился ли `aria-label`/класс
   в компоненте; `getByRole` предпочтительнее CSS.
4. Не добавляй `waitForTimeout` вместо ожидания состояния: хелперы уже
   обрабатывают boot splash, cookie notice и коучмарки.
