# Доступ из РФ

**Статус (2026-11-17):** прод на VPS в РФ (`89.108.81.141`), Docker + `@sveltejs/adapter-node` + Caddy. Каноникал: `https://www.repdraft.ru`.

Vercel больше не используется для продакшена.

## Стек

| Слой | Выбор |
|---|---|
| App | SvelteKit + `adapter-node` |
| Контейнер | `Dockerfile` + `docker-compose.yml` |
| TLS / proxy | Caddy (`deploy/Caddyfile`) |
| DNS | Рег.ру: A `@` и A `www` → IP VPS |

## Деплой

```bash
PUBLIC_SITE_URL=https://www.repdraft.ru npm run build
# rsync build/ + .env на /opt/repdraft
ssh root@VPS 'cd /opt/repdraft && docker compose up -d --build'
```

Проверка из РФ:

```bash
npm run check:rf
```

## История

Раньше сайт на Vercel / Cloudflare обрывался из РФ на крупных ответах (~16 КБ). Переезд на VPS в РФ закрыл этот контур. Детали старых экспериментов - в git history этого файла до 2026-11-17.
