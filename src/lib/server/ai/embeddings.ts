import embeddingsJson from '../../../../static/data/exercises.embeddings.json';
import { hintsFromBrief } from './catalog';
import { authenticatedJsonPost } from './chat';
import { resolveEmbeddingsConfig, ollamaEmbeddingsFallback, type AiConfig } from './config';
import { exerciseEmbedText } from './embedText';

export { exerciseEmbedText } from './embedText';

export type EmbeddingRow = { id: string; vec: number[] };

export type EmbeddingIndexFile = {
	provider: string;
	model: string;
	dims: number;
	items: EmbeddingRow[];
};

const BRIEF_CACHE_MAX = 64;
const briefCache = new Map<string, number[]>();

function cacheGet(key: string): number[] | undefined {
	const v = briefCache.get(key);
	if (!v) return undefined;
	// LRU touch
	briefCache.delete(key);
	briefCache.set(key, v);
	return v;
}

function cacheSet(key: string, vec: number[]): void {
	if (briefCache.has(key)) briefCache.delete(key);
	briefCache.set(key, vec);
	while (briefCache.size > BRIEF_CACHE_MAX) {
		const oldest = briefCache.keys().next().value;
		if (oldest === undefined) break;
		briefCache.delete(oldest);
	}
}

export function cosine(a: number[], b: number[]): number {
	const n = Math.min(a.length, b.length);
	if (!n) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < n; i++) {
		const x = a[i]!;
		const y = b[i]!;
		dot += x * y;
		na += x * x;
		nb += y * y;
	}
	if (na === 0 || nb === 0) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

let cachedIndex: EmbeddingIndexFile | null | undefined;

/** Load precomputed exercise embeddings (null if missing/empty). */
export function loadEmbeddingIndex(): EmbeddingIndexFile | null {
	if (cachedIndex !== undefined) return cachedIndex;
	const raw = embeddingsJson as EmbeddingIndexFile | EmbeddingRow[] | null;
	if (!raw) {
		cachedIndex = null;
		return null;
	}
	if (Array.isArray(raw)) {
		cachedIndex = raw.length
			? { provider: 'unknown', model: 'unknown', dims: raw[0]?.vec?.length ?? 0, items: raw }
			: null;
		return cachedIndex;
	}
	if (!raw.items?.length) {
		cachedIndex = null;
		return null;
	}
	cachedIndex = raw;
	return cachedIndex;
}

/** Test hook / build script. */
export function setEmbeddingIndexForTests(index: EmbeddingIndexFile | null): void {
	cachedIndex = index;
}

function extractVectors(text: string, expected: number): number[][] {
	const data = JSON.parse(text) as {
		data?: Array<{ embedding?: number[]; index?: number }>;
		embedding?: number[];
	};
	// Ollama native /api/embed style sometimes returns single embedding
	if (Array.isArray(data.embedding)) {
		return [data.embedding];
	}
	const rows = Array.isArray(data.data) ? [...data.data] : [];
	rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
	const out = rows.map((r) => r.embedding).filter((v): v is number[] => Array.isArray(v));
	if (out.length !== expected) {
		throw new Error(`embeddings: expected ${expected} vectors, got ${out.length}`);
	}
	return out;
}

async function embedViaOpenAiCompat(cfg: AiConfig, texts: string[]): Promise<number[][]> {
	const res = await authenticatedJsonPost(cfg, '/embeddings', {
		model: cfg.model,
		input: texts
	});
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`embeddings failed (${res.status}): ${res.text.slice(0, 200)}`);
	}
	return extractVectors(res.text, texts.length);
}

/** Ollama native batch when OpenAI-compat path is flaky. */
async function embedViaOllamaNative(cfg: AiConfig, texts: string[]): Promise<number[][]> {
	const base = cfg.baseUrl.replace(/\/v1\/?$/, '');
	const out: number[][] = [];
	for (const prompt of texts) {
		const res = await authenticatedJsonPost(
			{ ...cfg, baseUrl: base },
			'/api/embeddings',
			{ model: cfg.model, prompt }
		);
		if (res.status < 200 || res.status >= 300) {
			throw new Error(`ollama embeddings failed (${res.status}): ${res.text.slice(0, 200)}`);
		}
		const parsed = JSON.parse(res.text) as { embedding?: number[] };
		if (!Array.isArray(parsed.embedding)) {
			throw new Error('ollama embeddings: missing embedding');
		}
		out.push(parsed.embedding);
	}
	return out;
}

/** Embed one or more texts. Uses EMBEDDINGS_* config (default Ollama nomic-embed-text). */
export async function embed(texts: string[]): Promise<number[][]> {
	if (!texts.length) return [];
	const cfg = resolveEmbeddingsConfig();
	if (!cfg) throw new Error('Embeddings provider not configured');

	if (cfg.provider === 'ollama') {
		try {
			return await embedViaOpenAiCompat(cfg, texts);
		} catch {
			return embedViaOllamaNative(cfg, texts);
		}
	}

	try {
		return await embedViaOpenAiCompat(cfg, texts);
	} catch {
		// GigaChat PERS often 402 on embeddings → Ollama fallback
		const fallback = ollamaEmbeddingsFallback();
		try {
			return await embedViaOpenAiCompat(fallback, texts);
		} catch {
			return embedViaOllamaNative(fallback, texts);
		}
	}
}

/** Embed a brief with LRU cache (keyed by model+text). Expands zone hints for denser match. */
export async function embedBrief(brief: string): Promise<number[]> {
	const cfg = resolveEmbeddingsConfig();
	const model = cfg?.model ?? 'nomic-embed-text';
	const hints = hintsFromBrief(brief);
	const expanded =
		hints.parts.length || hints.equipment.length
			? `${brief} | ${[...hints.parts, ...hints.equipment].join(' ')}`
			: brief;
	const key = `${model}::${expanded}`;
	const hit = cacheGet(key);
	if (hit) return hit;
	const [vec] = await embed([expanded]);
	if (!vec) throw new Error('embedBrief: empty vector');
	cacheSet(key, vec);
	return vec;
}

export function clearBriefEmbedCache(): void {
	briefCache.clear();
}
