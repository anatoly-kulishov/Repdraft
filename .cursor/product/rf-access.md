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

**Авто:** GitHub Actions `Deploy web (RF VPS)` на каждый push в `main` (и `workflow_dispatch`). Секреты репозитория: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PATH`, плюс `PUBLIC_*` для сборки. Runtime-секреты (YooKassa, GigaChat, service role) только в `/opt/repdraft/.env` на VPS - CI их не трогает.

**Вручную:**

```bash
PUBLIC_SITE_URL=https://www.repdraft.ru npm run build
npm run deploy:vps
# или: VPS_SSH_KEY=~/.ssh/repdraft_deploy npm run deploy:vps
```

Проверка из РФ:

```bash
npm run check:rf
```

## История

Раньше сайт на Vercel / Cloudflare обрывался из РФ на крупных ответах (~16 КБ). Переезд на VPS в РФ закрыл этот контур. Детали старых экспериментов - в git history этого файла до 2026-11-17.
