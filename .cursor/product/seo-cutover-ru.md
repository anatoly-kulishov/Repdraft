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

В GSC выбран **Verify domain ownership via DNS**. В зоне Рег.ру (ispmanager → DNS для `repdraft.ru`) добавь **новую** TXT (SPF не трогай):

| Тип | Имя | Значение |
|---|---|---|
| TXT | `@` (или пусто / `repdraft.ru.`) | `google-site-verification=Y8MEIF_Vbn_b3ImSzPY6Xaf3N6gXR0rcRvcPGDu_pUg` |

Проверка снаружи: `dig +short TXT repdraft.ru @8.8.8.8` - должна появиться строка с `google-site-verification=Y8MEIF_…`. Потом в GSC → **Verify**. DNS может дойти за минуты, иногда до суток. **Не трогай** A `@` / A `www` → `89.108.81.141`.

### URL prefix `https://www.repdraft.ru` (meta, запасной)

В коде уже есть meta через `PUBLIC_GOOGLE_SITE_VERIFICATION=Y8MEIF_Vbn_b3ImSzPY6Xaf3N6gXR0rcRvcPGDu_pUg` (токен без префикса `google-site-verification=`).

1. После деплоя: view-source главной → `google-site-verification`
2. **Sitemaps** → `https://www.repdraft.ru/sitemap.xml`
3. На старом `https://www.repdraft.xyz` (если есть): **Change of address** → `https://www.repdraft.ru`

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
