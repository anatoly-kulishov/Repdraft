-- Community technique clips (video → GIF)
-- Run in Supabase SQL Editor after the base schema.sql
-- Then also run technique_clips_moderation.sql (reports + rate limit)

create table if not exists public.technique_clips (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  author_label text not null default '',
  gif_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists technique_clips_exercise_created_idx
  on public.technique_clips (exercise_id, created_at desc);

create index if not exists technique_clips_user_idx
  on public.technique_clips (user_id, created_at desc);

alter table public.technique_clips enable row level security;

drop policy if exists "clips_select_all" on public.technique_clips;
drop policy if exists "clips_insert_own" on public.technique_clips;
drop policy if exists "clips_delete_own" on public.technique_clips;

-- Anyone signed-in or anon can browse community clips
create policy "clips_select_all" on public.technique_clips
  for select using (true);

create policy "clips_insert_own" on public.technique_clips
  for insert with check (auth.uid() = user_id);

create policy "clips_delete_own" on public.technique_clips
  for delete using (auth.uid() = user_id);

-- Storage bucket for GIF files (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technique-gifs',
  'technique-gifs',
  true,
  5242880,
  array['image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "technique_gifs_public_read" on storage.objects;
drop policy if exists "technique_gifs_insert_own" on storage.objects;
drop policy if exists "technique_gifs_delete_own" on storage.objects;

create policy "technique_gifs_public_read" on storage.objects
  for select using (bucket_id = 'technique-gifs');

create policy "technique_gifs_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'technique-gifs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "technique_gifs_delete_own" on storage.objects
  for delete using (
    bucket_id = 'technique-gifs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
