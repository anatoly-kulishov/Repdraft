# Доступ из РФ: сайт недоступен без VPN

**Статус:** диагноз закрыт, нужен переезд DNS на Cloudflare (шаги ниже).
**Дата:** 2026-10-26.

## Симптом

`https://www.repdraft.xyz` не открывается из российских сетей: браузер показывает **белый экран без ошибки** — и на мобильном интернете (LTE), и в офисной сети. С VPN всё работает.

## Диагноз

Сайт жив. Проблема на пути «российская сеть → edge-сеть Vercel».

Проверено с трёх сторон:

| Что проверяли | Результат |
|---|---|
| Независимый сервис вне РФ (`api.microlink.io`) | открыл сайт, вернул реальные title/description/логотип |
| HEAD-запрос к сайту | 200 стабильно, ~0.15 с |
| `GET /robots.txt` (190 Б) | 200 стабильно |
| `GET /` (60 КБ) | приходит через раз или не приходит |
| `GET /og-image.jpg` | 0/3 — обрыв |
| `GET` с `Range: 0-32767` | 0/3 — обрыв |
| `github.com` (580 КБ) | 200 стабильно |
| `www.cloudflare.com` (1.3 МБ) | 200 стабильно |
| `vercel.com`, `nextjs.org` | **0 байт** — тот же обрыв |

Ключевое: обрыв воспроизводится на **любом сайте, размещённом на Vercel**, а не только на нашем. Маленькие ответы (до ~8–10 КБ) проходят, крупные — обрываются. Порог нестабилен и плавает около 16 КБ (размер TLS-записи), то есть это **дроп пакетов по объёму**, а не блокировка по имени домена.

ICMP при этом чистый (0% потерь), TLS-хендшейк проходит с настоящим сертификатом Let's Encrypt — режется именно тело ответа.

## Почему смена домена не поможет

`repdraft.ru` (или любой другой домен) на Vercel приземлится на те же IP-сети и будет обрезаться так же. Домен имеет смысл покупать для бренда и российских платежей, но не как лекарство от недоступности.

## Фикс: Cloudflare перед Vercel

Клиент из РФ будет соединяться с Cloudflare (он из РФ доступен: 1.3 МБ отдаёт стабильно), а Cloudflare — с Vercel. Кода не трогаем, домен не меняем.

### 1. Добавить домен в Cloudflare

1. Регистрация на [cloudflare.com](https://dash.cloudflare.com) → **Add a site** → `repdraft.xyz` → план **Free**.
2. Cloudflare выдаст две пары nameserver, например `ada.ns.cloudflare.com` и `bob.ns.cloudflare.com`.

### 2. Сменить NS у регистратора

Домен сейчас на NS Vercel (`ns1/ns2.vercel-dns.com`). Зайти туда, где куплен `repdraft.xyz`, и заменить nameserver на выданные Cloudflare. Распространение — от 15 минут до суток.

### 3. Записи DNS в Cloudflare

| Тип | Имя | Значение | Прокси |
|---|---|---|---|
| A | `@` | `216.198.79.1` | **Proxied** (оранжевое облако) |
| A | `@` | `64.29.17.65` | **Proxied** |
| CNAME | `www` | `cname.vercel-dns.com` | **Proxied** |
| TXT | `@` | `google-site-verification=5bXGtK0AixSZr1PLvIAYQuZdZpBb4FD-v2aJi6V-byc` | DNS only |
| TXT | `_vercel` | значение из Vercel → Settings → Domains (если Vercel его требует) | DNS only |
| CAA | `@` | `0 issue "letsencrypt.org"` | DNS only |
| CAA | `@` | `0 issue "pki.goog"` | DNS only |
| CAA | `@` | `0 issue "sectigo.com"` | DNS only |

CAA важен: без него Cloudflare не выпустит Universal SSL.

### 4. Настройки Cloudflare

| Настройка | Значение | Почему |
|---|---|---|
| SSL/TLS → Overview | **Full (strict)** | Cloudflare → Vercel по HTTPS с валидным сертификатом |
| SSL/TLS → Edge Certificates → Always Use HTTPS | On | http → https на краю |
| Speed → Optimization → **Rocket Loader** | **Off** | ломает SvelteKit |
| Speed → Optimization → Auto Minify | **Off** | не нужен, ломает разметку |
| Security → Bots → **Bot Fight Mode** | **Off** | иначе режет людей с VPN/мобильных |
| Security → Settings → Under Attack Mode | Off | по умолчанию выключен |
| Caching → Cache Rules | Bypass для `/_app/env.js` и `text/html` | env.js и HTML должны быть свежими |

Cloudflare по умолчанию не кэширует HTML, а `_app/immutable/*` кэширует — это правильно, файлы там хэшированные.

### 5. Vercel

Домен оставить как есть. Убедиться, что **Domains → Redirect to www выключен** — редирект apex → www делает `src/hooks.server.ts`.

### 6. Проверка

```bash
npm run check:rf
```

Ожидаемый результат: все строки `✓ 3/3`, включая 32 КБ и картинку. Дополнительно проверить с телефона на мобильном интернете.

## Если Cloudflare не помог

Cloudflare в РФ тоже периодически замедляют. Тогда по возрастанию трудозатрат:

1. **Cloudflare Pages** — разместить сам сайт на Cloudflare (`@sveltejs/adapter-cloudflare`), убрав Vercel из цепочки полностью. Нужно проверить серверные ручки: `/ai`, удаление аккаунта, загрузка аватара (`SUPABASE_SERVICE_ROLE_KEY` на CF через переменные окружения).
2. **Российский хостинг** (Timeweb Cloud, Selectel) + `@sveltejs/adapter-node`. Гарантированно доступно из РФ, полный Node. Минус — сервер и его обслуживание.

## Откат

Вернуть NS регистратора на `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. Распространение — до суток.

## Что учесть

- Vercel за прокси видит IP Cloudflare, поэтому гео-аналитика и rate limit по IP будут врать. Для нашего приложения это не критично.
- `EXPO_PUBLIC_WEB_ORIGIN` в мобилке менять не нужно — домен тот же.
- Мобилка тянет каталог и технику с `www.repdraft.xyz`; после фикса крупные картинки (сейчас обрываются на ~3 КБ) начнут доезжать.
