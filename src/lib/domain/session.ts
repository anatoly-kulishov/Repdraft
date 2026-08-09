import { newId } from './id';
import type {
	LastPerformance,
	LoggedSet,
	SessionExercise,
	WorkoutPlan,
	WorkoutSession
} from './types';

function emptySets(count: number, targetReps: number): LoggedSet[] {
	const n = Math.max(1, count);
	return Array.from({ length: n }, () => ({
		weightKg: null,
		reps: targetReps,
		completed: false
	}));
}

/** Snapshot a saved plan into a runnable session (prescription → log slots). */
export function startSessionFromPlan(plan: WorkoutPlan): WorkoutSession {
	const startedAt = new Date().toISOString();
	return {
		id: newId(),
		planId: plan.id,
		planName: plan.name,
		startedAt,
		finishedAt: null,
		exercises: plan.exercises.map(
			(ex): SessionExercise => ({
				exerciseId: ex.exerciseId,
				groupId: ex.groupId ?? null,
				targetSets: ex.sets,
				targetReps: ex.reps,
				restSec: ex.restSec,
				sets: emptySets(ex.sets, ex.reps)
			})
		)
	};
}

export function updateLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number,
	patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'completed'>>
): WorkoutSession {
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		const sets = ex.sets.map((s, si) => (si === setIndex ? { ...s, ...patch } : s));
		return { ...ex, sets };
	});
	return { ...session, exercises };
}

export function addLoggedSet(session: WorkoutSession, exerciseIndex: number): WorkoutSession {
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		return {
			...ex,
			sets: [...ex.sets, { weightKg: null, reps: ex.targetReps, completed: false }]
		};
	});
	return { ...session, exercises };
}

export function finishSession(session: WorkoutSession): WorkoutSession {
	return { ...session, finishedAt: new Date().toISOString() };
}

export function restSecAfterSet(session: WorkoutSession, exerciseIndex: number): number {
	const ex = session.exercises[exerciseIndex];
	if (!ex) return 0;
	return Math.max(0, ex.restSec);
}

/**
 * Latest finished session’s completed sets for an exercise.
 * Prefers the most recent finished session that has ≥1 completed set.
 */
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
		const done = ex.sets.filter((s) => s.completed);
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

export function completedSetCount(session: WorkoutSession): number {
	return session.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.completed).length, 0);
}

export function totalSetCount(session: WorkoutSession): number {
	return session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
}
