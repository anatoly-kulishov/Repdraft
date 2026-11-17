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

1. [search.google.com/search-console](https://search.google.com/search-console) → **Add property** → URL prefix `https://www.repdraft.ru`
2. Подтверждение (любой способ):
   - **DNS TXT** в зоне Рег.ру (ispmanager):  
     Тип `TXT`, имя `@`, значение вида `google-site-verification=…` (токен из GSC; старый с `.xyz` может не подойти - возьми новый из мастера)
   - или meta: `PUBLIC_GOOGLE_SITE_VERIFICATION=…` → пересборка/деплой VPS
3. **Sitemaps** → `https://www.repdraft.ru/sitemap.xml`
4. На **старом** свойстве `https://www.repdraft.xyz` (если ещё есть): **Settings → Change of address** → новый `https://www.repdraft.ru` (нужны оба свойства подтверждены; редиректы со старого домена помогают)

## DNS (Рег.ру / ispmanager)

Для Google DNS-метода:

| Тип | Имя | Значение |
|---|---|---|
| TXT | `@` / `repdraft.ru.` | `google-site-verification=ТОКЕН_ИЗ_GSC` |

Не трогай A `@` / A `www` на VPS (`89.108.81.141`).

## После подтверждения

- В GSC: URL Inspection на главную + пару статей, Request indexing
- В Вебмастере: переобход главной
- Через 1-2 недели смотреть покрытие; `.xyz` можно оставить с 308 на `.ru`, пока есть трафик/индекс

## Env на VPS (опционально)

В `/opt/repdraft/.env`:

```env
PUBLIC_GOOGLE_SITE_VERIFICATION=
PUBLIC_YANDEX_VERIFICATION=a7a3007bd3b3955c
```

Meta-токены пекутся на **build** (GitHub Actions secrets + локальный `.env`). HTML-файл Яндекса лежит в `static/` и попадает в образ при деплое. После правки env: merge в `main` (автодеплой) или `npm run build && npm run deploy:vps`.
