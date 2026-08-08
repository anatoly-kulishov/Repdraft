# Repdraft

Каталог упражнений и конструктор тренировок. Данные и медиа в `static/`. Планы и рекорды можно хранить локально или в облаке (**Supabase**), чтобы заходить с телефона и компьютера под одним аккаунтом.

## Возможности

- Каталог с поиском и фильтрами
- Карточка упражнения: GIF, RU-инструкции
- Конструктор тренировок (подходы / повторы / отдых)
- Личные рекорды (опционально)
- Аккаунт + синхронизация планов и рекордов через Supabase
- Техника сообщества: короткое видео → GIF на карточке упражнения (обмен ссылкой)

## Запуск локально

```bash
cd ~/WebstormProjects/repdraft
npm install
cp .env.example .env   # затем впишите ключи Supabase (или оставьте пустым для только-локального режима)
npm run dev
```

Без `.env` приложение работает как раньше — всё в `localStorage` на устройстве.

## Облако (Supabase) — чтобы открывать с телефона

### 1. Проект

1. Создайте проект на [supabase.com](https://supabase.com)
2. **SQL Editor** → вставьте и выполните [`supabase/schema.sql`](./supabase/schema.sql)
3. **Project Settings → API** → скопируйте `Project URL` и `anon public` key
4. В корне Repdraft:

```bash
cp .env.example .env
```

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

5. В Supabase: **Authentication → Providers → Email** — для удобства на старте можно выключить **Confirm email**, чтобы сразу входить с телефона без письма.

6. Перезапустите `npm run dev`, откройте **/auth**, зарегистрируйтесь.

При входе локальные планы/рекорды, которых ещё нет в облаке, подтягиваются наверх. Дальше CRUD идёт в Postgres (RLS: только свои строки).

### Техника сообщества (видео → GIF)

1. В **SQL Editor** выполните ещё [`supabase/technique_clips.sql`](./supabase/technique_clips.sql) — таблица `technique_clips` и bucket `technique-gifs`.
2. На карточке упражнения войдите в аккаунт, загрузите короткое видео (до ~6 сек / 15 МБ).
3. Браузер сделает GIF локально, затем можно опубликовать. GIF читают все; публиковать и удалять — только свой аккаунт.

### 2. Деплой (доступ по ссылке с телефона)

Удобный вариант — [Vercel](https://vercel.com):

1. Залейте репозиторий на GitHub
2. Import в Vercel, Framework: SvelteKit
3. Environment Variables: те же `PUBLIC_SUPABASE_URL` и `PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → откройте URL на телефоне, войдите в тот же аккаунт

В Supabase → **Authentication → URL Configuration** добавьте production URL в **Site URL** / **Redirect URLs**.

## Стек

- SvelteKit + TypeScript + Tailwind CSS 4
- Supabase Auth + Postgres (опционально)
- Домен в `src/lib/domain`, репозитории local / supabase

## Лицензия медиа

Медиа упражнений © [Gym visual](https://gymvisual.com/). См. [NOTICE.md](./NOTICE.md).

## Roadmap → Mobile

Веб уже открывается с телефона. Нативный клиент (Expo) позже может использовать тот же Supabase и `packages/core`.
