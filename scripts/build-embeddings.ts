/**
 * Precompute exercise embeddings → static/data/exercises.embeddings.json
 *
 * Uses Ollama nomic-embed-text by default (GigaChat embeddings often 402 on PERS).
 *
 * Run (from repdraft root, Ollama up + model pulled):
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./scripts/build-embeddings.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exerciseEmbedText } from '../src/lib/server/ai/embedText.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'static/data/exercises.index.json');
const outPath = join(root, 'static/data/exercises.embeddings.json');

type IndexItem = {
	id: string;
	name: string;
	name_ru?: string;
	body_part: string;
	target: string;
	muscle_group: string;
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

	const index = JSON.parse(readFileSync(indexPath, 'utf8')) as IndexItem[];
	console.log(`index=${index.length} model=${model} base=${ollamaBase}`);

	const BATCH = 16;
	const items: Array<{ id: string; vec: number[] }> = [];
	let dims = 0;

	for (let i = 0; i < index.length; i += BATCH) {
		const chunk = index.slice(i, i + BATCH);
		const texts = chunk.map(exerciseEmbedText);
		const vecs = await embedBatch(texts, model, ollamaBase);
		for (let j = 0; j < chunk.length; j++) {
			const vec = vecs[j]!;
			dims = vec.length;
			items.push({ id: chunk[j]!.id, vec });
		}
		console.log(`… ${Math.min(i + BATCH, index.length)}/${index.length}`);
	}

	const payload = {
		provider: 'ollama',
		model,
		dims,
		items
	};
	writeFileSync(outPath, JSON.stringify(payload));
	console.log(`wrote ${outPath} (${items.length} × ${dims})`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
