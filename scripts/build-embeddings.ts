/**
 * Embed exercise chunks → Supabase `exercise_chunks` (pgvector).
 *
 * Prerequisites: apply SQL in `.cursor/product/exercise-rag.md`, Ollama up,
 * `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
 *
 *   npm run build:embeddings
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EMBEDDING_DIMS = 768;
const STEPS_CHUNK_MAX_CHARS = 1500;
const UPSERT_BATCH = 50;
const EMBED_BATCH = 16;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fullPath = join(root, 'data/exercises.full.json');

type FullExercise = {
	id: string;
	name: string;
	name_ru?: string;
	body_part: string;
	target: string;
	muscle_group: string;
	equipment: string;
	instructions?: { ru?: string; en?: string } | string | null;
	instruction_steps?: { ru?: string[]; en?: string[] } | string[] | null;
};

type ChunkKind = 'meta' | 'steps';

type Chunk = {
	id: string;
	exerciseId: string;
	chunkKind: ChunkKind;
	content: string;
	bodyPart: string;
	target: string;
	equipment: string;
};

function loadDotEnv(): void {
	try {
		const raw = readFileSync(join(root, '.env'), 'utf8');
		for (const line of raw.split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const i = t.indexOf('=');
			if (i < 0) continue;
			const k = t.slice(0, i).trim();
			let v = t.slice(i + 1).trim();
			if (
				(v.startsWith('"') && v.endsWith('"')) ||
				(v.startsWith("'") && v.endsWith("'"))
			) {
				v = v.slice(1, -1);
			}
			if (!(k in process.env)) process.env[k] = v;
		}
	} catch {
		/* no .env */
	}
}

function exerciseEmbedText(ex: FullExercise): string {
	const title = ex.name_ru || ex.name;
	return `${title} | ${ex.body_part} | ${ex.target} | ${ex.muscle_group} | ${ex.equipment}`;
}

function asSteps(raw: unknown, lang: 'ru' | 'en'): string[] {
	if (!raw) return [];
	if (Array.isArray(raw)) {
		return raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
	}
	if (typeof raw === 'object') {
		const o = raw as { ru?: unknown; en?: unknown };
		const pick = lang === 'ru' ? o.ru : o.en;
		if (Array.isArray(pick)) {
			return pick.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
		}
	}
	return [];
}

function stepsText(ex: FullExercise): string {
	const ruSteps = asSteps(ex.instruction_steps, 'ru');
	const enSteps = asSteps(ex.instruction_steps, 'en');
	const steps = ruSteps.length ? ruSteps : enSteps;
	if (steps.length) return steps.join(' ').replace(/\s+/g, ' ').trim();
	const instr = ex.instructions;
	if (typeof instr === 'string' && instr.trim()) return instr.trim();
	if (instr && typeof instr === 'object') {
		const ru = typeof instr.ru === 'string' ? instr.ru.trim() : '';
		const en = typeof instr.en === 'string' ? instr.en.trim() : '';
		return ru || en;
	}
	return '';
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).trimEnd()}...`;
}

function chunkExercise(ex: FullExercise): Chunk[] {
	const bodyPart = ex.body_part ?? '';
	const target = ex.target ?? '';
	const equipment = ex.equipment ?? '';
	const out: Chunk[] = [
		{
			id: `${ex.id}:meta`,
			exerciseId: ex.id,
			chunkKind: 'meta',
			content: exerciseEmbedText(ex),
			bodyPart,
			target,
			equipment
		}
	];
	const steps = stepsText(ex);
	if (steps) {
		out.push({
			id: `${ex.id}:steps`,
			exerciseId: ex.id,
			chunkKind: 'steps',
			content: truncate(steps, STEPS_CHUNK_MAX_CHARS),
			bodyPart,
			target,
			equipment
		});
	}
	return out;
}

function round4(v: number): number {
	return Math.round(v * 1e4) / 1e4;
}

async function embedBatch(texts: string[], model: string, base: string): Promise<number[][]> {
	const out: number[][] = [];
	for (const prompt of texts) {
		const res = await fetch(`${base}/api/embeddings`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, prompt })
		});
		if (!res.ok) {
			throw new Error(`embed failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
		}
		const data = (await res.json()) as { embedding?: number[] };
		if (!Array.isArray(data.embedding)) throw new Error('missing embedding');
		out.push(data.embedding.map(round4));
	}
	return out;
}

async function main() {
	loadDotEnv();
	const model = (process.env.EMBEDDINGS_MODEL || 'nomic-embed-text').trim();
	const ollamaBase = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1')
		.replace(/\/v1\/?$/, '')
		.replace(/\/$/, '');
	const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL ?? '')
		.trim()
		.replace(/\/rest\/v1\/?$/, '')
		.replace(/\/$/, '');
	const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

	const missing: string[] = [];
	if (!supabaseUrl.startsWith('https://')) missing.push('PUBLIC_SUPABASE_URL');
	if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
	if (missing.length) {
		throw new Error(`Missing in .env: ${missing.join(', ')} (see .cursor/product/exercise-rag.md)`);
	}

	const full = JSON.parse(readFileSync(fullPath, 'utf8')) as FullExercise[];
	if (!Array.isArray(full) || !full.length) {
		throw new Error(`Missing or empty ${fullPath}`);
	}

	const chunks: Chunk[] = [];
	for (const ex of full) {
		if (!ex?.id) continue;
		chunks.push(...chunkExercise(ex));
	}

	console.log(
		`exercises=${full.length} chunks=${chunks.length} model=${model} dims=${EMBEDDING_DIMS} base=${ollamaBase}`
	);

	const admin = createClient(supabaseUrl, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

	let upserted = 0;
	for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
		const batch = chunks.slice(i, i + EMBED_BATCH);
		const texts = batch.map((c) => c.content);
		const vecs = await embedBatch(texts, model, ollamaBase);
		const rows = [];
		for (let j = 0; j < batch.length; j++) {
			const vec = vecs[j]!;
			if (vec.length !== EMBEDDING_DIMS) {
				throw new Error(`expected ${EMBEDDING_DIMS}-d embedding, got ${vec.length}`);
			}
			const c = batch[j]!;
			rows.push({
				id: c.id,
				exercise_id: c.exerciseId,
				chunk_kind: c.chunkKind,
				content: c.content,
				body_part: c.bodyPart,
				target: c.target,
				equipment: c.equipment,
				embedding: vec,
				model,
				updated_at: new Date().toISOString()
			});
		}

		for (let u = 0; u < rows.length; u += UPSERT_BATCH) {
			const slice = rows.slice(u, u + UPSERT_BATCH);
			let lastErr = '';
			for (let attempt = 1; attempt <= 4; attempt++) {
				const { error } = await admin.from('exercise_chunks').upsert(slice, { onConflict: 'id' });
				if (!error) {
					lastErr = '';
					break;
				}
				lastErr = error.message;
				const wait = attempt * 500;
				console.warn(`upsert retry ${attempt}/4: ${lastErr} (wait ${wait}ms)`);
				await new Promise((r) => setTimeout(r, wait));
			}
			if (lastErr) throw new Error(`upsert failed: ${lastErr}`);
			upserted += slice.length;
		}

		console.log(`… ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length}`);
	}

	console.log(`upserted ${upserted} chunks → ${supabaseUrl} (exercise_chunks)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
