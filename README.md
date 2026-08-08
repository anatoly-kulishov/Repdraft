# Repdraft

Каталог упражнений и конструктор тренировок. Данные в `static/`. Планы и рекорды - локально или в **Supabase**.

## Возможности

- Каталог, поиск, фильтры
- Карточка упражнения (GIF, инструкции)
- Конструктор тренировок
- Личные рекорды
- Аккаунт и синхронизация (Supabase)
- Техника сообщества: видео → GIF

## Запуск

```bash
npm install
cp .env.example .env   # ключи Supabase опциональны
npm run dev
```

Без `.env` всё остаётся в `localStorage`.

## Supabase

Схему БД и миграции держите **вне публичного репозитория** (локально / в приватном хранилище). В `.env` и на хостинге:

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

На проде задайте те же переменные и добавьте URL сайта в Supabase Auth (Site URL / Redirect URLs).

## Стек

SvelteKit, TypeScript, Tailwind CSS 4, Supabase (опционально).

Стандарты кода и слои: [AGENTS.md](./AGENTS.md).

## Лицензия медиа

Медиа упражнений © [Gym visual](https://gymvisual.com/). См. [NOTICE.md](./NOTICE.md).
