/**
 * «Умный подбор замены»: rank catalog exercises as substitutes for the one the
 * athlete is about to swap. Pure and client-agnostic, so the RN screen can reuse
 * the exact same order later.
 *
 * Signals (why a lift is a good substitute, strongest first):
 * - same `target` — the primary muscle the exercise trains. Alone it outweighs
 *   every other signal combined, so a hugely popular lift from another zone can
 *   never lead the list;
 * - same `body_part` — same zone, so a chest day stays a chest day;
 * - shared `secondary_muscles` — same supporting pattern (press → triceps);
 * - `globalPopularity` — how common the lift is, which is what spreads the head of
 *   the list across distinct movements (bench → dips → push-ups) instead of ten
 *   near-identical barbell-press variants.
 *
 * `equipment` is deliberately NOT scored: the catalog carries dozens of variants
 * per implement, so "same barbell" alone would flood the first screen with the
 * same lift again — the one thing an athlete replacing an exercise doesn't want.
 */
import type { ExerciseIndexItem } from './types';

export type ReplacementSeed = Pick<ExerciseIndexItem, 'id' | 'body_part' | 'target'> & {
	/** Optional: a partial seed (or an old cached index) may not carry it. */
	readonly secondary_muscles?: readonly string[];
};

export type ReplacementCandidate = {
	item: ExerciseIndexItem;
	score: number;
	/** Which signals fired, in weight order (QA / future “почему” hints). */
	signals: ReplacementSignal[];
};

export type ReplacementSignal = 'target' | 'body_part' | 'secondary' | 'popular';

const WEIGHT_TARGET = 40;
const WEIGHT_BODY_PART = 12;
const WEIGHT_SECONDARY = 2;
const SECONDARY_CAP = 8;
const WEIGHT_POPULARITY = 8;

function muscleSet(seed: ReplacementSeed): Set<string> {
	const own = [seed.target, ...(seed.secondary_muscles ?? [])];
	return new Set(own.filter(Boolean));
}

/** 0–100-ish relevance of `item` as a substitute for `seed`. */
export function replacementCandidateScore(
	item: ExerciseIndexItem,
	seed: ReplacementSeed,
	seedMuscles = muscleSet(seed)
): ReplacementCandidate {
	if (item.id === seed.id) return { item, score: -1, signals: [] };

	const signals: ReplacementSignal[] = [];
	let score = 0;

	if (item.target === seed.target) {
		score += WEIGHT_TARGET;
		signals.push('target');
	}
	if (item.body_part === seed.body_part) {
		score += WEIGHT_BODY_PART;
		signals.push('body_part');
	}
	let shared = 0;
	for (const muscle of item.secondary_muscles ?? []) {
		if (seedMuscles.has(muscle)) shared += 1;
	}
	if (shared > 0) {
		score += Math.min(shared * WEIGHT_SECONDARY, SECONDARY_CAP);
		signals.push('secondary');
	}

	const popularity = Math.max(0, Math.min(100, item.globalPopularity ?? 0));
	if (popularity > 0) {
		score += (popularity / 100) * WEIGHT_POPULARITY;
		signals.push('popular');
	}

	return { item, score, signals };
}

/**
 * Best substitutes first. The seed itself is never returned; ties go to the more
 * popular lift, then to the stable id so the order never flickers between renders.
 */
export function rankReplacementCandidates(
	items: readonly ExerciseIndexItem[],
	seed: ReplacementSeed,
	opts: { limit?: number } = {}
): ReplacementCandidate[] {
	const seedMuscles = muscleSet(seed);
	const limit = opts.limit ?? Number.POSITIVE_INFINITY;

	return items
		.filter((item) => item.id !== seed.id)
		.map((item) => replacementCandidateScore(item, seed, seedMuscles))
		.sort(
			(a, b) =>
				b.score - a.score ||
				(b.item.globalPopularity ?? 0) - (a.item.globalPopularity ?? 0) ||
				a.item.id.localeCompare(b.item.id)
		)
		.slice(0, Math.max(0, limit));
}

/** Same order, items only — the shape the picker list wants. */
export function replacementCandidateItems(
	items: readonly ExerciseIndexItem[],
	seed: ReplacementSeed,
	opts: { limit?: number } = {}
): ExerciseIndexItem[] {
	return rankReplacementCandidates(items, seed, opts).map((row) => row.item);
}

export function runReplacementCandidatesSelfCheck(): void {
	const seed: ReplacementSeed = {
		id: 'press-bb',
		body_part: 'chest',
		target: 'pectorals',
		secondary_muscles: ['triceps', 'shoulders']
	};

	const item = (
		id: string,
		body_part: string,
		target: string,
		equipment: string,
		secondary: string[],
		popularity = 0
	): ExerciseIndexItem => ({
		id,
		name: id,
		body_part,
		target,
		equipment,
		secondary_muscles: secondary,
		muscle_group: target,
		image: '',
		globalPopularity: popularity
	});

	const catalog = [
		item(seed.id, 'chest', 'pectorals', 'barbell', ['triceps']),
		// Same target + zone + supporting muscle, but other implement.
		item('press-db', 'chest', 'pectorals', 'dumbbell', ['triceps'], 30),
		// Same target + zone, no supporting overlap.
		item('press-machine', 'chest', 'pectorals', 'machine', [], 10),
		// Same target + zone + overlapping muscles, and very popular.
		item('pushup', 'chest', 'pectorals', 'body weight', ['triceps'], 95),
		// Other zone, other muscle.
		item('row-bb', 'back', 'lats', 'barbell', ['biceps'], 20),
		// Other zone, other muscle, hugely popular.
		item('squat', 'upper legs', 'quads', 'barbell', [], 100)
	];

	const ranked = rankReplacementCandidates(catalog, seed);
	if (ranked.some((row) => row.item.id === seed.id)) {
		throw new Error('replacementCandidates: seed must be excluded');
	}
	if (ranked.length !== catalog.length - 1) {
		throw new Error('replacementCandidates: every other item must survive');
	}
	// A target match (40) always beats every other combination (max 12+8+8=28),
	// so hugely popular lifts from another zone never lead the swap list.
	const firstNonTarget = ranked.findIndex((row) => !row.signals.includes('target'));
	if (firstNonTarget !== 3) {
		throw new Error('replacementCandidates: target matches must come first');
	}
	const order = ranked.map((row) => row.item.id);
	// Popularity only breaks near-ties: same signals, more popular wins.
	if (!(order.indexOf('pushup') < order.indexOf('press-db'))) {
		throw new Error('replacementCandidates: popularity tie-break (target)');
	}
	if (!(order.indexOf('squat') < order.indexOf('row-bb'))) {
		throw new Error('replacementCandidates: popularity tie-break (same score shape)');
	}
	if (order.indexOf('press-machine') < order.indexOf('press-db')) {
		throw new Error('replacementCandidates: fewer shared muscles must not win');
	}

	const tie = rankReplacementCandidates(
		[
			item('a', 'chest', 'pectorals', 'barbell', [], 5),
			item('b', 'chest', 'pectorals', 'barbell', [], 80)
		],
		seed
	);
	if (tie[0]?.item.id !== 'b') throw new Error('replacementCandidates: popularity tie-break (flat)');
	// Stable order for identical scores.
	const stable = rankReplacementCandidates(
		[
			item('z', 'chest', 'pectorals', 'barbell', []),
			item('y', 'chest', 'pectorals', 'barbell', [])
		],
		seed
	);
	if (stable.map((row) => row.item.id).join(',') !== 'y,z') {
		throw new Error('replacementCandidates: deterministic tie order');
	}
	if (replacementCandidateItems(catalog, seed, { limit: 2 }).length !== 2) {
		throw new Error('replacementCandidates: limit');
	}
	// Missing secondary muscles must not throw.
	rankReplacementCandidates(
		[item('x', 'chest', 'pectorals', 'barbell', [])],
		{ ...seed, secondary_muscles: undefined }
	);
}
