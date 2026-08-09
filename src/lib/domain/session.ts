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

/** Throws if live session log / previous-performance invariants regress. */
export function runSessionSelfCheck(): void {
	const plan: WorkoutPlan = {
		id: 'p1',
		name: 'Push',
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-08-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'ex-a', sets: 3, reps: 8, restSec: 90 },
			{ exerciseId: 'ex-b', sets: 3, reps: 10, restSec: 60 }
		]
	};

	let session = startSessionFromPlan(plan);
	if (totalSetCount(session) !== 6) {
		throw new Error(`totalSetCount expected 6, got ${totalSetCount(session)}`);
	}
	if (completedSetCount(session) !== 0) throw new Error('new session should have 0 completed');

	session = updateLoggedSet(session, 0, 0, { weightKg: 40, reps: 8, completed: true });
	if (completedSetCount(session) !== 1) {
		throw new Error(`completedSetCount expected 1, got ${completedSetCount(session)}`);
	}

	session = finishSession(session);
	if (!session.finishedAt) throw new Error('finishSession should set finishedAt');

	const last = lastPerformance([session], 'ex-a');
	if (!last || last.weightKg !== 40 || last.reps !== 8 || last.sets !== 1) {
		throw new Error(`lastPerformance unexpected ${JSON.stringify(last)}`);
	}
	if (lastPerformance([session], 'ex-b') !== null) {
		throw new Error('ex-b with no completed sets should have null lastPerformance');
	}

	session = addLoggedSet(session, 0);
	if (session.exercises[0]!.sets.length !== 4) {
		throw new Error('addLoggedSet should append a set');
	}
}
