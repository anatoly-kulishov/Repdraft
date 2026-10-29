/**
 * "Часто тренируете" rail: exercises the user logged most often in a recent
 * window, with a cold-start fallback to four staple lifts.
 */
import { isProgressSet } from './sessionSetKind';
import type { WorkoutSession } from './types';

export const FREQUENT_WINDOW_DAYS = 90;
export const FREQUENT_LIMIT = 10;

/** Cold start: Жим лёжа, Приседания, Становая тяга, Подтягивания. */
export const POPULAR_EXERCISE_IDS = ['0025', '0043', '0032', '0652'] as const;

export type FrequentExercise = {
	exerciseId: string;
	/** Finished sessions in the window where this exercise had ≥1 working set. */
	count: number;
	/** Newest such session (ISO) - tie-breaker / future "last time" hints. */
	lastAt: string | null;
};

/**
 * Top exercises by how often they were logged (one count per session, working
 * sets only). Sorted by count desc, then most recent.
 */
export function frequentExercises(
	sessions: readonly WorkoutSession[],
	opts: { days?: number; limit?: number; now?: Date } = {}
): FrequentExercise[] {
	const days = opts.days ?? FREQUENT_WINDOW_DAYS;
	const limit = opts.limit ?? FREQUENT_LIMIT;
	const now = opts.now ?? new Date();
	const cutoff = now.getTime() - days * 86_400_000;
	const map = new Map<string, { count: number; lastAt: string | null }>();

	for (const session of sessions) {
		if (!session.finishedAt) continue;
		const finishedAt = Date.parse(session.finishedAt);
		if (!Number.isFinite(finishedAt) || finishedAt < cutoff) continue;
		const seen = new Set<string>();
		for (const exercise of session.exercises) {
			if (exercise.skipped || seen.has(exercise.exerciseId)) continue;
			const logged = exercise.sets.some((set) => set.completed && isProgressSet(set));
			if (!logged) continue;
			seen.add(exercise.exerciseId);
			const prev = map.get(exercise.exerciseId);
			map.set(exercise.exerciseId, {
				count: (prev?.count ?? 0) + 1,
				lastAt:
					prev?.lastAt && prev.lastAt > session.finishedAt
						? prev.lastAt
						: session.finishedAt
			});
		}
	}

	return [...map.entries()]
		.map(([exerciseId, row]) => ({ exerciseId, ...row }))
		.sort((a, b) => b.count - a.count || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
		.slice(0, Math.max(0, limit));
}
