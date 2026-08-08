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

## UI

- Примитивы: `.panel`, `.btn-primary|secondary|danger|ghost|link`, `.page-title`, `.page-lead`.  
- Одна primary-задача на блок.  
- Язык: `/auth` (Профиль).  
- PWA: `static/manifest.webmanifest`, `static/icon.svg`.

## Релизы

- Ветка: `cursor/vX.Y.Z-short-slug`  
- patch = фиксы/polish, minor = фича  
- После merge в `main` - GitHub Release с тем же тегом  

## Что не делать

- Хардкод Supabase URL/JWT в коде  
- Дублировать primary CTA в одном вьюпорте  
- Тяжёлый encode на main thread на телефоне  
- README-/доки «на вырост» без запроса  
