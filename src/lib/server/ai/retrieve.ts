import type { ExerciseIndexItem } from '$lib/domain/types';
import { isExerciseRagConfigured } from '$lib/server/supabase/admin';
import { effectivePartsFromBrief, popularity, slimCatalogForBrief } from './catalog';
import { embedBrief } from './embeddings';
import { matchExercisesByEmbedding } from './matchExercises';
import { matchTemplate, type SplitTemplate } from './splitTemplates';

export const RETRIEVE_TOP_K = 40;

export type ScoredExercise = {
	exercise: ExerciseIndexItem;
	score: number;
	source: 'cosine' | 'regex' | 'hybrid';
};

export type RetrieveResult = {
	exercises: ExerciseIndexItem[];
	template: SplitTemplate | null;
	mode: 'hybrid' | 'regex';
	scores: ScoredExercise[];
};

function majorityParts(items: ExerciseIndexItem[]): string[] {
	const counts = new Map<string, number>();
	for (const ex of items.slice(0, 20)) {
		counts.set(ex.body_part, (counts.get(ex.body_part) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([p]) => p);
}

function regexResult(
	brief: string,
	index: ExerciseIndexItem[],
	topK: number
): RetrieveResult {
	const hinted = effectivePartsFromBrief(brief);
	const regexSlim = slimCatalogForBrief(index, brief).slice(0, topK);
	const parts = hinted.length ? hinted : majorityParts(regexSlim);
	return {
		exercises: regexSlim,
		template: matchTemplate(parts, hinted),
		mode: 'regex',
		scores: regexSlim.map((exercise) => ({
			exercise,
			score: popularity(exercise) / 100,
			source: 'regex' as const
		}))
	};
}

/**
 * Hybrid retrieve: pgvector cosine ∪ regex slim.
 * Falls back to regex-only when service role / RPC / embed fails.
 */
export async function retrieve(
	brief: string,
	index: ExerciseIndexItem[],
	opts: { topK?: number } = {}
): Promise<RetrieveResult> {
	const topK = opts.topK ?? RETRIEVE_TOP_K;
	const hinted = effectivePartsFromBrief(brief);
	const regexSlim = slimCatalogForBrief(index, brief);
	const regexIds = new Set(regexSlim.map((e) => e.id));

	if (!isExerciseRagConfigured()) {
		return regexResult(brief, index, topK);
	}

	const byId = new Map(index.map((e) => [e.id, e]));
	const scoreMap = new Map<string, ScoredExercise>();

	try {
		const q = await embedBrief(brief);
		const matched = await matchExercisesByEmbedding(q, {
			topK,
			bodyParts: hinted.length ? hinted : undefined
		});
		if (!matched.length) {
			return regexResult(brief, index, topK);
		}
		for (const row of matched) {
			const exercise = byId.get(row.exerciseId);
			if (!exercise) continue;
			scoreMap.set(row.exerciseId, {
				exercise,
				score: row.similarity,
				source: regexIds.has(row.exerciseId) ? 'hybrid' : 'cosine'
			});
		}
	} catch {
		return regexResult(brief, index, topK);
	}

	for (const ex of regexSlim) {
		const prev = scoreMap.get(ex.id);
		if (prev) {
			prev.score = Math.max(prev.score, 0.55 + popularity(ex) / 400);
			prev.source = 'hybrid';
		} else {
			scoreMap.set(ex.id, {
				exercise: ex,
				score: 0.5 + popularity(ex) / 400,
				source: 'regex'
			});
		}
	}

	const merged = [...scoreMap.values()].sort((a, b) => b.score - a.score);
	const exercises = merged.slice(0, topK).map((s) => s.exercise);
	const parts = hinted.length ? hinted : majorityParts(exercises);
	return {
		exercises,
		template: matchTemplate(parts, hinted),
		mode: 'hybrid',
		scores: merged.slice(0, topK)
	};
}

/** Sync path used when async retrieve is unnecessary (tests / offline). */
export function retrieveRegexOnly(
	brief: string,
	index: ExerciseIndexItem[],
	topK = RETRIEVE_TOP_K
): RetrieveResult {
	return regexResult(brief, index, topK);
}
