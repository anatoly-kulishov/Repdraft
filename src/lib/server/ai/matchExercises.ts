import { getSupabaseAdmin } from '$lib/server/supabase/admin';
import { EMBEDDING_DIMS } from './exerciseChunks';

export type MatchedExerciseChunk = {
	exerciseId: string;
	chunkKind: string;
	content: string;
	bodyPart: string;
	target: string;
	equipment: string;
	similarity: number;
};

type RpcRow = {
	exercise_id: string;
	chunk_kind: string;
	content: string;
	body_part: string;
	target: string;
	equipment: string;
	similarity: number;
};

/**
 * Top-k exercises by cosine similarity via `match_exercises` RPC.
 * Returns [] when service role missing, dims wrong, or RPC fails.
 */
export async function matchExercisesByEmbedding(
	queryEmbedding: number[],
	opts: { topK?: number; bodyParts?: string[] } = {}
): Promise<MatchedExerciseChunk[]> {
	if (queryEmbedding.length !== EMBEDDING_DIMS) return [];
	const admin = getSupabaseAdmin();
	if (!admin) return [];

	const topK = opts.topK ?? 40;
	const filter =
		opts.bodyParts && opts.bodyParts.length > 0 ? opts.bodyParts : null;

	const { data, error } = await admin.rpc('match_exercises', {
		query_embedding: queryEmbedding,
		match_count: topK,
		filter_body_parts: filter
	});

	if (error || !Array.isArray(data)) {
		if (error) console.warn('match_exercises RPC:', error.message);
		return [];
	}

	return (data as RpcRow[]).map((row) => ({
		exerciseId: row.exercise_id,
		chunkKind: row.chunk_kind,
		content: row.content,
		bodyPart: row.body_part,
		target: row.target,
		equipment: row.equipment,
		similarity: typeof row.similarity === 'number' ? row.similarity : 0
	}));
}
