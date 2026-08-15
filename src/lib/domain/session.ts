import { newId } from './id';
import type {
	LastPerformance,
	LoggedSet,
	SessionExercise,
	SetKind,
	WorkoutPlan,
	WorkoutSession
} from './types';
import { groupBounds } from './workout';

export function loggedSetKind(set: LoggedSet): SetKind {
	return set.kind ?? 'work';
}

/** Working sets drive “last time” / progress memory (skip warm-up). */
export function isProgressSet(set: LoggedSet): boolean {
	return loggedSetKind(set) !== 'warmup';
}

export function nextSetKind(kind: SetKind): SetKind {
	switch (kind) {
		case 'work':
			return 'warmup';
		case 'warmup':
			return 'drop';
		case 'drop':
			return 'work';
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

function emptySets(count: number, targetReps: number): LoggedSet[] {
	const n = Math.max(1, count);
	return Array.from({ length: n }, () => ({
		weightKg: null,
		reps: targetReps,
		completed: false,
		kind: 'work' as const
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

/**
 * Refresh prescription fields from the saved plan onto an active session.
 * Keeps logged sets; restores groupId/rest if the plan was edited after start.
 */
export function syncSessionPrescriptionFromPlan(
	session: WorkoutSession,
	plan: WorkoutPlan
): WorkoutSession {
	const byId = new Map(plan.exercises.map((ex) => [ex.exerciseId, ex]));
	let changed = false;
	const exercises = session.exercises.map((ex) => {
		const p = byId.get(ex.exerciseId);
		if (!p) return ex;
		const groupId = p.groupId ?? null;
		if (
			ex.groupId === groupId &&
			ex.restSec === p.restSec &&
			ex.targetSets === p.sets &&
			ex.targetReps === p.reps
		) {
			return ex;
		}
		changed = true;
		return {
			...ex,
			groupId,
			restSec: p.restSec,
			targetSets: p.sets,
			targetReps: p.reps
		};
	});
	return changed ? { ...session, exercises } : session;
}

/**
 * After completing set `setIndex` on `exerciseIndex`, pick the next exercise to focus.
 * Supersets go round-robin (A1 → B1 → A2…); solos advance when all sets are done.
 */
export function nextFocusAfterSetComplete(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number
): number {
	const bounds = groupBounds(session.exercises, exerciseIndex);
	if (bounds && bounds.start !== bounds.end) {
		for (let i = exerciseIndex + 1; i <= bounds.end; i++) {
			const set = session.exercises[i]?.sets[setIndex];
			if (set && !set.completed) return i;
		}
		for (let s = setIndex + 1; ; s++) {
			let sawSlot = false;
			for (let i = bounds.start; i <= bounds.end; i++) {
				const set = session.exercises[i]?.sets[s];
				if (!set) continue;
				sawSlot = true;
				if (!set.completed) return i;
			}
			if (!sawSlot) break;
		}
		if (bounds.end + 1 < session.exercises.length) return bounds.end + 1;
		return exerciseIndex;
	}

	const ex = session.exercises[exerciseIndex];
	if (
		ex &&
		ex.sets.length > 0 &&
		ex.sets.every((s) => s.completed) &&
		exerciseIndex + 1 < session.exercises.length
	) {
		return exerciseIndex + 1;
	}
	return exerciseIndex;
}

export function updateLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number,
	patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'completed' | 'kind'>>
): WorkoutSession {
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		const sets = ex.sets.map((s, si) => (si === setIndex ? { ...s, ...patch } : s));
		return { ...ex, sets };
	});
	return { ...session, exercises };
}

export function addLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	kind: SetKind = 'work'
): WorkoutSession {
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		return {
			...ex,
			sets: [
				...ex.sets,
				{ weightKg: null, reps: ex.targetReps, completed: false, kind }
			]
		};
	});
	return { ...session, exercises };
}

/** Drop a logged set. Keeps at least one row so the exercise stays loggable. */
export function removeLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number
): WorkoutSession {
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		if (ex.sets.length <= 1) return ex;
		if (setIndex < 0 || setIndex >= ex.sets.length) return ex;
		return { ...ex, sets: ex.sets.filter((_, si) => si !== setIndex) };
	});
	return { ...session, exercises };
}

export function finishSession(session: WorkoutSession): WorkoutSession {
	return { ...session, finishedAt: new Date().toISOString() };
}

export function restSecAfterSet(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex?: number
): number {
	const ex = session.exercises[exerciseIndex];
	if (!ex) return 0;
	if (setIndex != null) {
		const set = ex.sets[setIndex];
		if (set && loggedSetKind(set) === 'warmup') return 0;
	}
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
		if (done.length === 0) continue;
		out.push({
			sessionId: session.id,
			planName: session.planName,
			finishedAt: session.finishedAt!,
			sets: done.map((s) => ({
				weightKg: s.weightKg,
				reps: s.reps,
				kind: loggedSetKind(s)
			}))
		});
		if (out.length >= limit) break;
	}
	return out;
}

/** Prefer newer finishedAt, then startedAt. Keep device-only rows. */
export function mergeWorkoutSessions(
	local: WorkoutSession[],
	cloud: WorkoutSession[]
): WorkoutSession[] {
	const map = new Map<string, WorkoutSession>();
	for (const session of local) map.set(session.id, session);
	for (const session of cloud) {
		const prev = map.get(session.id);
		if (!prev) {
			map.set(session.id, session);
			continue;
		}
		const prevKey = `${prev.finishedAt ?? ''}\0${prev.startedAt}`;
		const nextKey = `${session.finishedAt ?? ''}\0${session.startedAt}`;
		if (nextKey.localeCompare(prevKey) >= 0) map.set(session.id, session);
	}
	return [...map.values()].sort((a, b) => {
		const af = a.finishedAt ?? a.startedAt;
		const bf = b.finishedAt ?? b.startedAt;
		return bf.localeCompare(af);
	});
}

export function completedSetCount(session: WorkoutSession): number {
	return session.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.completed).length, 0);
}

export function totalSetCount(session: WorkoutSession): number {
	return session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
}

/** Exercise done when every logged set is completed (empty exercise list → 0). */
export function completedExerciseCount(session: WorkoutSession): number {
	return session.exercises.filter(
		(ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed)
	).length;
}

export function sessionDurationMs(session: WorkoutSession): number | null {
	const end = session.finishedAt ?? null;
	if (!end) return null;
	const ms = new Date(end).getTime() - new Date(session.startedAt).getTime();
	if (!Number.isFinite(ms) || ms < 0) return null;
	return ms;
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
	if (completedExerciseCount(session) !== 0) {
		throw new Error('new session should have 0 completed exercises');
	}

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
	const logs = recentExerciseLogs([session], 'ex-a', 5);
	if (logs.length !== 1 || logs[0]!.sets.length !== 1 || logs[0]!.sets[0]!.weightKg !== 40) {
		throw new Error(`recentExerciseLogs unexpected ${JSON.stringify(logs)}`);
	}
	if (recentExerciseLogs([session], 'ex-b').length !== 0) {
		throw new Error('ex-b should have empty recentExerciseLogs');
	}

	session = addLoggedSet(session, 0);
	if (session.exercises[0]!.sets.length !== 4) {
		throw new Error('addLoggedSet should append a set');
	}
	const afterRemove = removeLoggedSet(session, 0, 3);
	if (afterRemove.exercises[0]!.sets.length !== 3) {
		throw new Error('removeLoggedSet should drop the extra set');
	}
	session = afterRemove;
	const onlyOne: WorkoutSession = {
		...session,
		exercises: session.exercises.map((ex, ei) =>
			ei === 0 ? { ...ex, sets: [ex.sets[0]!] } : ex
		)
	};
	if (removeLoggedSet(onlyOne, 0, 0).exercises[0]!.sets.length !== 1) {
		throw new Error('removeLoggedSet must keep at least one set');
	}

	const groupedPlan: WorkoutPlan = {
		id: 'p2',
		name: 'SS',
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-08-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'ex-a', sets: 2, reps: 10, restSec: 0, groupId: 'g1' },
			{ exerciseId: 'ex-b', sets: 2, reps: 12, restSec: 90, groupId: 'g1' },
			{ exerciseId: 'ex-c', sets: 2, reps: 8, restSec: 60 }
		]
	};
	let ss = startSessionFromPlan(groupedPlan);
	if (ss.exercises[0]?.groupId !== 'g1' || ss.exercises[1]?.groupId !== 'g1') {
		throw new Error('startSessionFromPlan should keep groupId');
	}
	ss = updateLoggedSet(ss, 0, 0, { reps: 10, completed: true });
	if (nextFocusAfterSetComplete(ss, 0, 0) !== 1) {
		throw new Error('superset should advance A1 → B1');
	}
	ss = updateLoggedSet(ss, 1, 0, { reps: 12, completed: true });
	if (nextFocusAfterSetComplete(ss, 1, 0) !== 0) {
		throw new Error('superset should advance B1 → A2');
	}
	ss = updateLoggedSet(ss, 0, 1, { reps: 10, completed: true });
	ss = updateLoggedSet(ss, 1, 1, { reps: 12, completed: true });
	if (nextFocusAfterSetComplete(ss, 1, 1) !== 2) {
		throw new Error('finished superset should advance to next solo');
	}

	const stale = startSessionFromPlan({
		...groupedPlan,
		exercises: groupedPlan.exercises.map(({ groupId: _g, ...ex }) => ex)
	});
	const synced = syncSessionPrescriptionFromPlan(stale, groupedPlan);
	if (synced.exercises[0]?.groupId !== 'g1') {
		throw new Error('syncSessionPrescriptionFromPlan should restore groupId');
	}

	if (nextSetKind('work') !== 'warmup' || nextSetKind('drop') !== 'work') {
		throw new Error('nextSetKind cycle failed');
	}

	let warm = startSessionFromPlan(plan);
	warm = updateLoggedSet(warm, 0, 0, {
		weightKg: 20,
		reps: 8,
		completed: true,
		kind: 'warmup'
	});
	warm = updateLoggedSet(warm, 0, 1, { weightKg: 50, reps: 5, completed: true, kind: 'work' });
	warm = finishSession(warm);
	const lastWork = lastPerformance([warm], 'ex-a');
	if (!lastWork || lastWork.weightKg !== 50 || lastWork.sets !== 1) {
		throw new Error(`warmup should not drive lastPerformance ${JSON.stringify(lastWork)}`);
	}

	const older: WorkoutSession = {
		...warm,
		id: 'merge-old',
		finishedAt: '2026-01-01T00:00:00.000Z'
	};
	const newer: WorkoutSession = {
		...warm,
		id: 'merge-old',
		finishedAt: '2026-02-01T00:00:00.000Z',
		planName: 'Newer'
	};
	const merged = mergeWorkoutSessions([older], [newer, { ...warm, id: 'cloud-only' }]);
	if (merged.length !== 2 || merged.find((s) => s.id === 'merge-old')?.planName !== 'Newer') {
		throw new Error(`mergeWorkoutSessions unexpected ${JSON.stringify(merged.map((s) => s.id))}`);
	}
}
