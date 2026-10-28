import { effectivePartsFromBrief, hintsFromBrief } from './catalog';
import { authenticatedJsonPost } from './chat';
import { resolveEmbeddingsConfig, ollamaEmbeddingsFallback, type AiConfig } from './config';
import { exerciseEmbedText } from './embedText';

export { exerciseEmbedText } from './embedText';

const BRIEF_CACHE_MAX = 64;
const briefCache = new Map<string, number[]>();

function cacheGet(key: string): number[] | undefined {
	const v = briefCache.get(key);
	if (!v) return undefined;
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

function extractVectors(text: string, expected: number): number[][] {
	const data = JSON.parse(text) as {
		data?: Array<{ embedding?: number[]; index?: number }>;
		embedding?: number[];
	};
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
	const parts = effectivePartsFromBrief(brief);
	const expanded =
		parts.length || hints.equipment.length
			? `${brief} | ${[...parts, ...hints.equipment].join(' ')}`
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
