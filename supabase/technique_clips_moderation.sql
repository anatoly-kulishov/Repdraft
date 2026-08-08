-- Moderation for community technique clips
-- Run in Supabase SQL Editor (after technique_clips.sql)

alter table public.technique_clips
  add column if not exists hidden boolean not null default false;

alter table public.technique_clips
  add column if not exists report_count integer not null default 0;

create index if not exists technique_clips_visible_created_idx
  on public.technique_clips (created_at desc)
  where hidden = false;

-- Hide reported clips from public browse (author can still see own)
drop policy if exists "clips_select_all" on public.technique_clips;
drop policy if exists "clips_select_visible" on public.technique_clips;
create policy "clips_select_visible" on public.technique_clips
  for select using (hidden = false or auth.uid() = user_id);

create table if not exists public.technique_clip_reports (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.technique_clips (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (clip_id, reporter_id)
);

create index if not exists technique_clip_reports_clip_idx
  on public.technique_clip_reports (clip_id);

alter table public.technique_clip_reports enable row level security;

drop policy if exists "clip_reports_insert_own" on public.technique_clip_reports;
drop policy if exists "clip_reports_select_own" on public.technique_clip_reports;

-- Authenticated users can report others' clips (one report per clip)
create policy "clip_reports_insert_own" on public.technique_clip_reports
  for insert with check (
    auth.uid() = reporter_id
    and exists (
      select 1
      from public.technique_clips c
      where c.id = clip_id
        and c.user_id <> auth.uid()
        and c.hidden = false
    )
  );

create policy "clip_reports_select_own" on public.technique_clip_reports
  for select using (auth.uid() = reporter_id);

-- Auto-hide after enough reports
create or replace function public.technique_clip_on_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.technique_clips
  set report_count = report_count + 1
  where id = new.clip_id
  returning report_count into new_count;

  if new_count >= 3 then
    update public.technique_clips
    set hidden = true
    where id = new.clip_id;
  end if;

  return new;
end;
$$;

drop trigger if exists technique_clip_reports_after_insert on public.technique_clip_reports;
create trigger technique_clip_reports_after_insert
  after insert on public.technique_clip_reports
  for each row execute function public.technique_clip_on_report();

-- Max 5 published clips per user per rolling 24h
create or replace function public.technique_clip_rate_limit()
returns trigger
language plpgsql
as $$
declare
  recent integer;
begin
  select count(*)::integer into recent
  from public.technique_clips
  where user_id = new.user_id
    and created_at > now() - interval '24 hours';

  if recent >= 5 then
    raise exception 'RATE_LIMIT: max 5 technique clips per 24 hours'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists technique_clips_rate_limit_before_insert on public.technique_clips;
create trigger technique_clips_rate_limit_before_insert
  before insert on public.technique_clips
  for each row execute function public.technique_clip_rate_limit();
