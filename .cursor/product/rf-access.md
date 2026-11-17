# Доступ из РФ: переезд на Node VPS

**Статус:** домен `www.repdraft.ru` на Vercel (Valid), из РФ без VPN по-прежнему ненадёжно. Цель - **VPS в РФ** + `@sveltejs/adapter-node` + Caddy.
**Дата:** 2026-11-17.

## Почему не Vercel / Cloudflare

Обрыв крупных ответов (~16 КБ) из РФ воспроизводился и на Vercel, и через Cloudflare (см. историю ниже). Смена домена на `.ru` бренд и ЮKassa не лечит. Нужен хостинг с IP в РФ.

## Целевой стек

| Слой | Выбор |
|---|---|
| App | SvelteKit + `@sveltejs/adapter-node` → `npm run build` / `npm start` |
| Контейнер | `Dockerfile` + `docker-compose.yml` |
| TLS / proxy | Caddy (`deploy/Caddyfile`) |
| DNS | Рег.ру зона: A `@` и A `www` → **IP VPS** (не Vercel) |

Shared hosting Рег.ру (заглушка «Почти готово») **не подходит**: нет Node для API (`/ai`, billing, account).

## Cutover

1. Арендовать VPS в РФ (Timeweb Cloud / Selectel / VPS Рег.ру), Ubuntu 22.04+, открыть 80/443.
2. На сервере: Docker + Compose, клон репо, `.env` с теми же секретами, что на Vercel.
3. `docker compose up -d --build`
4. В ispmanager DNS:
   - удалить A/CNAME на Vercel (`216.198.79.1`, `*.vercel-dns-017.com`)
   - A `@` → IP VPS
   - A `www` → IP VPS (оба A, без CNAME на Vercel)
5. Дождаться TLS у Caddy, проверить:
   - `curl -sI https://www.repdraft.ru` → не `server: Vercel`
   - `npm run check:rf`
6. Vercel Domains: снять `repdraft.ru` / `www` после стабильной недели (или сразу).
7. Supabase / ЮKassa уже на `.ru` - URL не менять.

Проверка из РФ без VPN:

```bash
npm run check:rf
# или
npm run check:rf -- https://www.repdraft.ru
```

Ожидание: HTML, JS-чанк, 32 КБ и картинка - стабильно `✓`.

## История (2026-10-26, .xyz + Cloudflare)

Зона Cloudflare `active`, обрыв ~16 КБ сохранялся. Вывод: ограничение по SNI/домену на пути из РФ, прокси перед Vercel не лечит. Детали симптома и старые шаги Cloudflare сохранены в git history этого файла до 2026-11-17.
