# Exercise catalog RAG (Supabase pgvector)

Used by `/ai` plan retrieve and builder tune peers. Source of truth for schema: apply SQL below once in the Supabase SQL editor, then index with `npm run build:embeddings`.

Local copy of the same SQL (gitignored): `supabase/exercise-chunks-rag.sql`.

## Setup

1. Supabase → Database → Extensions → enable **vector** (or run SQL below).
2. Paste and run the SQL in this file (or the local `supabase/*.sql` copy).
3. Set in `.env` / Vercel:
   - `PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; upsert + RPC)
   - `EMBEDDINGS_PROVIDER=ollama` (default)
   - `EMBEDDINGS_MODEL=nomic-embed-text` (768-d)
   - `OLLAMA_BASE_URL=http://127.0.0.1:11434/v1`
4. `ollama pull nomic-embed-text`
5. `npm run build:embeddings`

Without service role or empty table, retrieve falls back to regex-only (AI still works).

## Chunks

| kind | content |
|------|---------|
| `meta` | `name_ru\|name` + body_part + target + muscle_group + equipment |
| `steps` | instruction steps RU (fallback EN), truncated |

## SQL

```sql
create extension if not exists vector;

create table if not exists public.exercise_chunks (
	id text primary key,
	exercise_id text not null,
	chunk_kind text not null check (chunk_kind in ('meta', 'steps')),
	content text not null,
	body_part text not null default '',
	target text not null default '',
	equipment text not null default '',
	embedding vector(768) not null,
	model text not null,
	updated_at timestamptz not null default now()
);

create index if not exists exercise_chunks_exercise_id_idx
	on public.exercise_chunks (exercise_id);

create index if not exists exercise_chunks_body_part_idx
	on public.exercise_chunks (body_part);

create index if not exists exercise_chunks_embedding_hnsw_idx
	on public.exercise_chunks
	using hnsw (embedding vector_cosine_ops);

alter table public.exercise_chunks enable row level security;

create or replace function public.match_exercises(
	query_embedding vector(768),
	match_count int default 40,
	filter_body_parts text[] default null
)
returns table (
	exercise_id text,
	chunk_kind text,
	content text,
	body_part text,
	target text,
	equipment text,
	similarity float
)
language sql
stable
as $$
	with ranked as (
		select
			c.exercise_id,
			c.chunk_kind,
			c.content,
			c.body_part,
			c.target,
			c.equipment,
			(1 - (c.embedding <=> query_embedding))::float as similarity,
			row_number() over (
				partition by c.exercise_id
				order by c.embedding <=> query_embedding
			) as rn
		from public.exercise_chunks c
		where
			filter_body_parts is null
			or cardinality(filter_body_parts) = 0
			or c.body_part = any (filter_body_parts)
	)
	select
		r.exercise_id,
		r.chunk_kind,
		r.content,
		r.body_part,
		r.target,
		r.equipment,
		r.similarity
	from ranked r
	where r.rn = 1
	order by r.similarity desc
	limit greatest(1, least(coalesce(match_count, 40), 200));
$$;

revoke all on function public.match_exercises(vector(768), int, text[]) from public;
grant execute on function public.match_exercises(vector(768), int, text[]) to service_role;
```
