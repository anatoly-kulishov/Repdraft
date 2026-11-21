# SEO cutover: repdraft.xyz → www.repdraft.ru

**Статус кода (2026-11-17):** canonical, `robots.txt` и `sitemap.xml` на проде уже отдают `https://www.repdraft.ru`. Файл Яндекса: `https://www.repdraft.ru/yandex_a7a3007bd3b3955c.html` (старый `yandex_f8fbc3ad7a8a9ac4.html` тоже лежит в `static/`).

Дальше - кабинеты Google и Яндекса (аккаунт владельца сайта).

## Проверка снаружи

```bash
curl -sI https://www.repdraft.ru/robots.txt
curl -s https://www.repdraft.ru/sitemap.xml | head
curl -s https://www.repdraft.ru/yandex_a7a3007bd3b3955c.html
```

Ожидание: `Sitemap: https://www.repdraft.ru/sitemap.xml`, в sitemap только `.ru` loc. В verification-файле: `Verification: a7a3007bd3b3955c`.

## Яндекс.Вебмастер

1. [webmaster.yandex.ru](https://webmaster.yandex.ru) → **Добавить сайт** → `https://www.repdraft.ru`
2. Подтверждение: HTML-файл `yandex_a7a3007bd3b3955c.html` или meta `yandex-verification` через `PUBLIC_YANDEX_VERIFICATION=a7a3007bd3b3955c`
3. **Индексирование → Файлы Sitemap** → добавить `https://www.repdraft.ru/sitemap.xml`
4. Если старый сайт был `www.repdraft.xyz`: **Инструменты → Переезд сайта** (или «Главное зеркало») → указать новый адрес `https://www.repdraft.ru`
5. Главное зеркало: `https://www.repdraft.ru` (не apex без www, если так каноникал в приложении)

## Google Search Console

### Domain property `repdraft.ru` (DNS TXT)

GSC ругается `We couldn't find your verification token`, если в DNS только SPF. Сейчас на ns1/ns2 Рег.ру **нет** `google-site-verification=…` - запись ещё не создана (или создана не в той зоне / не сохранилась).

В ispmanager → DNS зона **`repdraft.ru`** → **Create** (не Edit на SPF):

| Тип | Имя | Значение |
|---|---|---|
| TXT | `@` (пусто / корень зоны) | `google-site-verification=Y8MEIF_Vbn_b3ImSzPY6Xaf3N6gXR0rcRvcPGDu_pUg` |

Частые ошибки: править SPF вместо новой TXT; имя `www`; зона другого домена; не нажать Save.  
Проверка: `dig +short TXT repdraft.ru @ns1.hosting.reg.ru` - должны быть **две** строки (SPF и google). Потом GSC → **Verify**. A `@` / `www` не трогай.

### URL prefix `https://www.repdraft.ru` (meta, проще)

1. В GSC: **Back** / новое свойство типа **URL prefix** → `https://www.repdraft.ru`
2. Способ HTML-тег: meta уже на сайте (`PUBLIC_GOOGLE_SITE_VERIFICATION=Y8MEIF_Vbn_b3ImSzPY6Xaf3N6gXR0rcRvcPGDu_pUg`)
3. Проверка: view-source → `google-site-verification`
4. **Sitemaps** → `https://www.repdraft.ru/sitemap.xml`
5. Старое `.xyz` (если есть): **Change of address** → `https://www.repdraft.ru`

## После подтверждения

- В GSC: URL Inspection на главную + пару статей, Request indexing
- В Вебмастере: переобход главной
- Через 1-2 недели смотреть покрытие; `.xyz` можно оставить с 308 на `.ru`, пока есть трафик/индекс

## Env на VPS (опционально)

В `/opt/repdraft/.env`:

```env
PUBLIC_GOOGLE_SITE_VERIFICATION=Y8MEIF_Vbn_b3ImSzPY6Xaf3N6gXR0rcRvcPGDu_pUg
PUBLIC_YANDEX_VERIFICATION=a7a3007bd3b3955c
```

Meta-токены пекутся на **build** (GitHub Actions secrets + локальный `.env`). HTML-файл Яндекса лежит в `static/` и попадает в образ при деплое. После правки env: merge в `main` (автодеплой) или `npm run build && npm run deploy:vps`.

## Мультиязычные зеркала `/en/*` (SEO-контент)

Канонический язык остаётся русским: голые пути (`/tools/bmi`) - это `.ru`-канон и цель 301-карты. Английские версии публичного контента живут под префиксом `/en/...` (как у workout.cool), с self-canonical, поэтому обе версии индексируются.

Правила для новой публичной страницы:

1. RU-роут с `prerender` (если контент статический) + `SeoHead path={...}`.
2. `alternates={ruEnAlternates(ruPath)}` - кластер `ru`, `en`, `x-default` (x-default = RU).
3. EN-зеркало `src/routes/en/<path>/+page.svelte` - тонкая обёртка: `<Page localeOverride="en" pathOverride={enPath(...)} />` (+ `+page.ts` с тем же `prerender`, для динамики - `entries()`).
4. Оба пути в `src/lib/seo/sitemap.ts`.
5. Внутренние ссылки внутри зеркала остаются в `/en/...` (хаб, карточки, футер); ссылки в приложение (`/builder`, `/live`) - русские, потому что у приложения зеркал нет.

`resolvedLocale` (`src/lib/stores/locale.ts`) - derived-стор: на `/en/*` интерфейс принудительно английский (включая SSR/prerender), на остальных путях - сохранённая пользователем локаль. Хранимая настройка при заходе на `/en/*` не меняется; выбор «ru» в переключателе языка уводит с префикса.

Сейчас зеркала есть у `/tools/*`, `/programs/*` и `/exercise/:id`:

- tools/programs - статические страницы, оба языка пререндерятся;
- упражнения - SSR (как и RU-страница, 1300+ записей), `/en/exercise/:id` отдаёт английские `name` и `instruction_steps.en`; обе версии попадают в sitemap, поэтому он вырос примерно до 2700 URL;
- хаб `/exercises` и статьи остаются RU-only: переведённого контента для них пока нет, а пустые зеркала только плодят soft-404.

Неизвестный slug/id (`/programs/nope`, `/en/exercise/nope`) отдаёт настоящий 404 из `load`, а не 200 с `noindex`: статус одинаков в dev и в проде, и не зависит от того, включён ли prerender.
