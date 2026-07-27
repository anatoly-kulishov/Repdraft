-- Repdraft schema for Supabase (Postgres)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists public.workout_plans (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_plans_user_updated_idx
  on public.workout_plans (user_id, updated_at desc);

create table if not exists public.personal_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  weight_kg numeric null,
  reps integer null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index if not exists personal_records_user_updated_idx
  on public.personal_records (user_id, updated_at desc);

alter table public.workout_plans enable row level security;
alter table public.personal_records enable row level security;

drop policy if exists "plans_select_own" on public.workout_plans;
drop policy if exists "plans_insert_own" on public.workout_plans;
drop policy if exists "plans_update_own" on public.workout_plans;
drop policy if exists "plans_delete_own" on public.workout_plans;

create policy "plans_select_own" on public.workout_plans
  for select using (auth.uid() = user_id);
create policy "plans_insert_own" on public.workout_plans
  for insert with check (auth.uid() = user_id);
create policy "plans_update_own" on public.workout_plans
  for update using (auth.uid() = user_id);
create policy "plans_delete_own" on public.workout_plans
  for delete using (auth.uid() = user_id);

drop policy if exists "records_select_own" on public.personal_records;
drop policy if exists "records_insert_own" on public.personal_records;
drop policy if exists "records_update_own" on public.personal_records;
drop policy if exists "records_delete_own" on public.personal_records;

create policy "records_select_own" on public.personal_records
  for select using (auth.uid() = user_id);
create policy "records_insert_own" on public.personal_records
  for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.personal_records
  for update using (auth.uid() = user_id);
create policy "records_delete_own" on public.personal_records
  for delete using (auth.uid() = user_id);
