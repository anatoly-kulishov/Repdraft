import type { LastPerformance, SessionExercise, SetKind, WorkoutSession } from './types';
import { isProgressSet, loggedSetKind } from './sessionSetKind';
import { visibleSessionExerciseIndices } from './sessionAlts';

export function previousSetAtIndex(
	sessions: WorkoutSession[],
	exerciseId: string,
	setIndex: number
): Pick<LastPerformance, 'weightKg' | 'reps'> | null {
	const finished = sessions
		.filter((s) => s.finishedAt)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));

	for (const session of finished) {
		const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
		if (!ex) continue;
		const hasProgress = ex.sets.some((s) => s.completed && isProgressSet(s));
		if (!hasProgress) continue;

		if (setIndex >= ex.sets.length) return null;
		const set = ex.sets[setIndex];
		if (!set?.completed || !isProgressSet(set)) return null;
		if (set.weightKg == null && set.reps == null) return null;
		return { weightKg: set.weightKg, reps: set.reps };
	}
	return null;
}

/**
 * Live draft hint for one open set: matching set index from last session,
 * else the last working set of that exercise.
 */
export function suggestedSetPerformance(
	sessions: WorkoutSession[],
	exerciseId: string,
	setIndex: number
): Pick<LastPerformance, 'weightKg' | 'reps'> | null {
	const atIndex = previousSetAtIndex(sessions, exerciseId, setIndex);
	if (atIndex) return atIndex;
	const last = lastPerformance(sessions, exerciseId);
	if (!last || (last.weightKg == null && last.reps == null)) return null;
	return { weightKg: last.weightKg, reps: last.reps };
}

export type ExercisePlanVsActual = {
	plannedSets: number;
	plannedReps: number;
	actualSets: number;
	actualReps: number | null;
	topWeightKg: number | null;
	outcome: 'match' | 'under' | 'over' | 'skipped' | 'empty';
};

/** Planned targets vs logged progress sets after finish (no charts). */
export function exercisePlanVsActual(ex: SessionExercise): ExercisePlanVsActual {
	const plannedSets = Math.max(0, ex.targetSets);
	const plannedReps = Math.max(0, ex.targetReps);
	if (ex.skipped) {
		return {
			plannedSets,
			plannedReps,
			actualSets: 0,
			actualReps: null,
			topWeightKg: null,
			outcome: 'skipped'
		};
	}
	const progress = ex.sets.filter((s) => s.completed && isProgressSet(s));
	if (progress.length === 0) {
		return {
			plannedSets,
			plannedReps,
			actualSets: 0,
			actualReps: null,
			topWeightKg: null,
			outcome: 'empty'
		};
	}
	const actualSets = progress.length;
	const repsList = progress
		.map((s) => s.reps)
		.filter((r): r is number => r != null && Number.isFinite(r));
	const actualReps = repsList.length > 0 ? repsList[repsList.length - 1]! : null;
	let topWeightKg: number | null = null;
	for (const set of progress) {
		if (set.weightKg == null || set.weightKg <= 0) continue;
		if (topWeightKg == null || set.weightKg > topWeightKg) topWeightKg = set.weightKg;
	}
	let outcome: ExercisePlanVsActual['outcome'] = 'match';
	if (actualSets < plannedSets || (actualReps != null && actualReps < plannedReps)) {
		outcome = 'under';
	} else if (actualSets > plannedSets || (actualReps != null && actualReps > plannedReps)) {
		outcome = 'over';
	}
	return { plannedSets, plannedReps, actualSets, actualReps, topWeightKg, outcome };
}

/** Compact plan/fact strings for the summary line. Null when nothing was logged. */
export function planVsActualParts(
	ex: SessionExercise
): { plan: string; actual: string; under: boolean } | null {
	const cmp = exercisePlanVsActual(ex);
	if (cmp.outcome === 'empty' || cmp.outcome === 'skipped') return null;
	const plan = `${cmp.plannedSets}×${cmp.plannedReps}`;
	const reps = cmp.actualReps != null ? String(cmp.actualReps) : '-';
	const actual =
		cmp.topWeightKg != null
			? `${cmp.actualSets}×${reps} · ${cmp.topWeightKg}`
			: `${cmp.actualSets}×${reps}`;
	return { plan, actual, under: cmp.outcome === 'under' };
}

export function lastPerformance(
	sessions: WorkoutSession[],
	exerciseId: string
): LastPerformance | null {
	const finished = sessions
		.filter((s) => s.finishedAt)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));

	for (const session of finished) {
		const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
		if (!ex) continue;
		const done = ex.sets.filter((s) => s.completed && isProgressSet(s));
		if (done.length === 0) continue;
		const last = done[done.length - 1];
		return {
			weightKg: last.weightKg,
			reps: last.reps,
			sets: done.length,
			finishedAt: session.finishedAt!
		};
	}
	return null;
}

export type ExerciseSessionLog = {
	sessionId: string;
	planName: string;
	finishedAt: string;
	sets: { weightKg: number | null; reps: number | null; kind?: SetKind }[];
	note?: string;
};

/** Recent finished sessions that logged this exercise (newest first). */
export function recentExerciseLogs(
	sessions: WorkoutSession[],
	exerciseId: string,
	limit = 5
): ExerciseSessionLog[] {
	const out: ExerciseSessionLog[] = [];
	const finished = sessions
		.filter((s) => s.finishedAt)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));

	for (const session of finished) {
		const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
		if (!ex) continue;
		const done = ex.sets.filter((s) => s.completed);
		const note = ex.note?.trim() ?? '';
		if (done.length === 0 && !note) continue;
		out.push({
			sessionId: session.id,
			planName: session.planName,
			finishedAt: session.finishedAt!,
			sets: done.map((s) => ({
				weightKg: s.weightKg,
				reps: s.reps,
				kind: loggedSetKind(s)
			})),
			...(note ? { note } : {})
		});
		if (out.length >= limit) break;
	}
	return out;
}


export function completedSetCount(session: WorkoutSession): number {
	return visibleSessionExerciseIndices(session).reduce((n, i) => {
		const ex = session.exercises[i];
		return n + (ex?.sets.filter((s) => s.completed).length ?? 0);
	}, 0);
}

export function totalSetCount(session: WorkoutSession): number {
	return visibleSessionExerciseIndices(session).reduce(
		(n, i) => n + (session.exercises[i]?.sets.length ?? 0),
		0
	);
}

/** Exercise done when every logged set is completed (empty exercise list → 0). */
export function completedExerciseCount(session: WorkoutSession): number {
	return visibleSessionExerciseIndices(session).filter((i) => {
		const ex = session.exercises[i];
		return Boolean(ex && ex.sets.length > 0 && ex.sets.every((s) => s.completed));
	}).length;
}

/** Sum of weightKg × reps for completed sets (bodyweight / missing weight skipped). */
export function sessionVolumeKg(session: WorkoutSession): number {
	let total = 0;
	for (const i of visibleSessionExerciseIndices(session)) {
		const ex = session.exercises[i];
		if (!ex) continue;
		// Holds/cardio log a duration, not reps: weight × seconds is not tonnage.
		if (ex.measure === 'seconds' || ex.measure === 'minutes') continue;
		for (const set of ex.sets) {
			if (!set.completed || set.weightKg == null || set.reps == null) continue;
			total += set.weightKg * set.reps;
		}
	}
	return total;
}

/** Heaviest completed working weight for one exercise. Warm-up and empty loads do not count. */
export function exerciseBestWeightKg(session: WorkoutSession, exerciseId: string): number | null {
	let best: number | null = null;
	for (const ex of session.exercises) {
		if (ex.skipped || ex.exerciseId !== exerciseId) continue;
		for (const set of ex.sets) {
			if (!set.completed || !isProgressSet(set)) continue;
			if (set.weightKg == null || set.weightKg <= 0) continue;
			if (best == null || set.weightKg > best) best = set.weightKg;
		}
	}
	return best;
}

/** Heaviest logged weight in one exercise block (completed sets). */
export function exerciseLogTopWeight(sets: { weightKg: number | null }[]): number | null {
	let top: number | null = null;
	for (const s of sets) {
		if (s.weightKg == null) continue;
		if (top === null || s.weightKg > top) top = s.weightKg;
	}
	return top;
}

/** Top-weight delta vs previous session of the same exercise; null when either lacks weight. */
export function exerciseLogWeightDelta(
	current: { sets: { weightKg: number | null }[] },
	previous: { sets: { weightKg: number | null }[] }
): number | null {
	const a = exerciseLogTopWeight(current.sets);
	const b = exerciseLogTopWeight(previous.sets);
	if (a === null || b === null) return null;
	return Math.round((a - b) * 4) / 4;
}

/** Latest finished session of the same plan strictly before `session` (summary tonnage delta). */
export function previousPlanSession(
	sessions: WorkoutSession[],
	session: WorkoutSession
): WorkoutSession | null {
	if (!session.planId || !session.finishedAt) return null;
	let best: WorkoutSession | null = null;
	for (const s of sessions) {
		if (s.id === session.id || s.planId !== session.planId) continue;
		if (!s.finishedAt || s.finishedAt >= session.finishedAt) continue;
		if (!best || (best.finishedAt ?? '') < s.finishedAt) best = s;
	}
	return best;
}

/** True when every visible set is logged — ready to finish the session. */
export function isSessionFullyLogged(session: WorkoutSession): boolean {
	const visible = visibleSessionExerciseIndices(session);
	if (visible.length === 0) {
		return session.exercises.some((ex) => ex.sets.some((s) => s.completed));
	}
	const total = totalSetCount(session);
	return total > 0 && completedSetCount(session) === total;
}

/** Logged payload only — ignores ids, timestamps, plan metadata. */
export function finishedSessionLogEqual(a: WorkoutSession, b: WorkoutSession): boolean {
	if (JSON.stringify(a.altChoices ?? {}) !== JSON.stringify(b.altChoices ?? {})) {
		return false;
	}
	if (a.exercises.length !== b.exercises.length) return false;
	return a.exercises.every((ex, index) => {
		const other = b.exercises[index];
		if (!other) return false;
		if (ex.exerciseId !== other.exerciseId) return false;
		if ((ex.groupId ?? null) !== (other.groupId ?? null)) return false;
		if ((ex.altGroupId ?? null) !== (other.altGroupId ?? null)) return false;
		if ((ex.skipped ?? false) !== (other.skipped ?? false)) return false;
		if (ex.sets.length !== other.sets.length) return false;
		return ex.sets.every((set, setIndex) => {
			const otherSet = other.sets[setIndex];
			if (!otherSet) return false;
			return (
				set.weightKg === otherSet.weightKg &&
				set.reps === otherSet.reps &&
				set.completed === otherSet.completed &&
				loggedSetKind(set) === loggedSetKind(otherSet)
			);
		});
	});
}
