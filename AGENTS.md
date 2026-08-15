# Repdraft — гайд для людей и агентов

Краткий контракт поддержки. Детали для Cursor: `.cursor/rules/`.

## Стек

SvelteKit, TypeScript, Tailwind 4, Supabase (опционально), мобильный / PWA first.

## Слои

1. **domain** - типы и чистая логика планов/рекордов/фильтров  
2. **storage** - local + Supabase репозитории  
3. **stores** - состояние сессии  
4. **components / routes** - UI  

Новый код клади в существующий слой. Не смешивай fetch/Supabase внутрь `domain`.

## Команды

```bash
npm install
cp .env.example .env   # PUBLIC_SUPABASE_* при необходимости
npm run dev            # LAN: --host уже в scripts
npm run check
npm run build
```

## Секреты и SQL

- Ключи только в `.env` / хостинге.  
- SQL-схемы и ops-скрипты **не** коммитить в публичный репозиторий (см. `.gitignore`).  
- Держи копии миграций локально / в приватном месте.

## Supabase Auth (обязательно донастроить для v0.6+)

Код уже умеет email/password, magic link, Google, reset password. Без dashboard-настроек кнопки упадут с «provider off» / не придёт письмо.

1. **Authentication → Providers**
   - Email: включён (magic link / OTP и reset идут через него)
   - Google: Enable + Client ID/Secret из Google Cloud Console
2. **Authentication → URL Configuration**
   - Site URL = прод (`https://YOUR_DOMAIN`)
   - Redirect URLs allow-list:
     - `https://YOUR_DOMAIN/auth`
     - `http://localhost:5173/auth`
     - `http://127.0.0.1:5173/auth` (и preview-порт при необходимости)
3. **Google Cloud** (если Google-вход): OAuth client type Web, authorized redirect URI =  
   `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Письма (confirm / magic / reset): Templates → убедись, что ссылки ведут на `{{ .RedirectTo }}` / сайт из Site URL.
5. После деплоя на Vercel: те же `PUBLIC_SUPABASE_*`, плюс redirect URL с прод-доменом уже в allow-list.
6. **Удаление аккаунта** (`/auth` → Удалить аккаунт): на сервере (Vercel) нужен `SUPABASE_SERVICE_ROLE_KEY` (не `PUBLIC_*`). Endpoint: `POST /api/account/delete`.

## UI

- Примитивы: `.panel`, `.btn-primary|secondary|danger|ghost|link`, `.page-title`, `.page-lead`.  
- Одна primary-задача на блок.  
- Язык: `/auth` (Профиль).  
- PWA: `static/manifest.webmanifest`, `static/icon.svg`.

## Релизы

- Ветка: `cursor/vX.Y.Z-short-slug`  
- patch = фиксы/polish, minor = фича  
- После merge в `main` - GitHub Release с тем же тегом  
- Идеи и приоритеты: `.cursor/product/market-roadmap.md`
- **MVP scope / UI/UX (главный):** `.cursor/product/mvp-spec.md`  

## Что не делать

- Хардкод Supabase URL/JWT в коде  
- Дублировать primary CTA в одном вьюпорте  
- Тяжёлый encode на main thread на телефоне  
- README-/доки «на вырост» без запроса  
