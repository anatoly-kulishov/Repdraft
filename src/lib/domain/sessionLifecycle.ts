import { newId } from './id';
import { REPS, REST_SEC, SETS } from './inputLimits';
import type {
	LoggedSet,
	SessionExercise,
	WorkoutExercise,
	WorkoutPlan,
	WorkoutSession
} from './types';
import { DEFAULT_REPS, DEFAULT_REST_SEC, DEFAULT_SETS } from './workout';
import { pruneUnchosenAlts, visibleSessionExerciseIndices } from './sessionAlts';

function emptySets(count: number, targetReps: number, scheme?: number[]): LoggedSet[] {
	if (scheme && scheme.length > 0) {
		return scheme.map((reps) => ({
			weightKg: null,
			reps,
			completed: false,
			kind: 'work' as const
		}));
	}
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
		altChoices: {},
		exercises: plan.exercises.map(
			(ex): SessionExercise => ({
				exerciseId: ex.exerciseId,
				groupId: ex.groupId ?? null,
				altGroupId: ex.altGroupId ?? null,
				targetSets: ex.sets,
				targetReps: ex.reps,
				restSec: ex.restSec,
				sets: emptySets(ex.sets, ex.reps, ex.repsScheme)
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
		const altGroupId = p.altGroupId ?? null;
		if (
			ex.groupId === groupId &&
			ex.altGroupId === altGroupId &&
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
			altGroupId,
			restSec: p.restSec,
			targetSets: p.sets,
			targetReps: p.reps
		};
	});
	return changed ? { ...session, exercises } : session;
}

function sessionExerciseFromPlan(ex: WorkoutExercise): SessionExercise {
	return {
		exerciseId: ex.exerciseId,
		groupId: ex.groupId ?? null,
		altGroupId: ex.altGroupId ?? null,
		targetSets: ex.sets,
		targetReps: ex.reps,
		restSec: ex.restSec,
		sets: emptySets(ex.sets, ex.reps, ex.repsScheme)
	};
}

function hasCompletedSet(ex: SessionExercise): boolean {
	return ex.sets.some((s) => s.completed);
}

/**
 * Remount an active session onto another plan.
 * Keeps session id / startedAt. Matching exerciseIds (in order, once each) keep
 * completed sets + note; open tails are dropped and padded to the new target.
 * Skipped slots without completed sets do not match. Exercises only on the old
 * session are dropped, even with logged sets.
 */
export function replaceSessionPlan(
	session: WorkoutSession,
	plan: WorkoutPlan
): WorkoutSession {
	const used = new Set<number>();
	const exercises = plan.exercises.map((planEx) => {
		const matchIndex = session.exercises.findIndex((prev, i) => {
			if (used.has(i)) return false;
			if (prev.exerciseId !== planEx.exerciseId) return false;
			if (prev.skipped && !hasCompletedSet(prev)) return false;
			return true;
		});
		if (matchIndex < 0) return sessionExerciseFromPlan(planEx);

		const prev = session.exercises[matchIndex]!;
		used.add(matchIndex);
		if (!hasCompletedSet(prev)) return sessionExerciseFromPlan(planEx);

		const completed = prev.sets.filter((s) => s.completed);
		const targetCount = Math.max(1, planEx.sets);
		const openNeeded = Math.max(0, targetCount - completed.length);
		const openTail =
			openNeeded > 0 ? emptySets(openNeeded, planEx.reps, undefined) : [];
		const note = prev.note?.trim() ? prev.note : undefined;
		return {
			exerciseId: planEx.exerciseId,
			groupId: planEx.groupId ?? null,
			altGroupId: planEx.altGroupId ?? null,
			targetSets: planEx.sets,
			targetReps: planEx.reps,
			restSec: planEx.restSec,
			sets: [...completed, ...openTail],
			...(note ? { note } : {})
		};
	});

	const planExerciseIds = new Set(plan.exercises.map((ex) => ex.exerciseId));
	const planAltGroups = new Set(
		plan.exercises
			.map((ex) => ex.altGroupId)
			.filter((id): id is string => typeof id === 'string' && id.length > 0)
	);
	const altChoices: Record<string, string> = {};
	for (const [groupId, exerciseId] of Object.entries(session.altChoices ?? {})) {
		if (!planAltGroups.has(groupId)) continue;
		if (!planExerciseIds.has(exerciseId)) continue;
		altChoices[groupId] = exerciseId;
	}

	return {
		...session,
		planId: plan.id,
		planName: plan.name,
		finishedAt: null,
		exercises,
		altChoices
	};
}

/** Throws if mid-session plan replace invariants regress. */
export function runSessionLifecycleSelfCheck(): void {
	const planA: WorkoutPlan = {
		id: 'plan-a',
		name: 'A',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'bench', sets: 3, reps: 8, restSec: 90 },
			{ exerciseId: 'fly', sets: 3, reps: 12, restSec: 60 }
		]
	};
	const planB: WorkoutPlan = {
		id: 'plan-b',
		name: 'B',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'bench', sets: 4, reps: 6, restSec: 120 },
			{ exerciseId: 'row', sets: 3, reps: 10, restSec: 90 }
		]
	};
	const started = startSessionFromPlan(planA);
	const withLogs: WorkoutSession = {
		...started,
		exercises: [
			{
				...started.exercises[0]!,
				sets: [
					{ weightKg: 40, reps: 8, completed: true, kind: 'work' },
					{ weightKg: 40, reps: 8, completed: false, kind: 'work' },
					{ weightKg: null, reps: 8, completed: false, kind: 'work' }
				],
				note: 'pause'
			},
			{
				...started.exercises[1]!,
				sets: [
					{ weightKg: 12, reps: 12, completed: true, kind: 'work' },
					{ weightKg: null, reps: 12, completed: false, kind: 'work' },
					{ weightKg: null, reps: 12, completed: false, kind: 'work' }
				]
			}
		]
	};

	const kept = replaceSessionPlan(withLogs, planB);
	if (kept.id !== withLogs.id || kept.startedAt !== withLogs.startedAt) {
		throw new Error('replaceSessionPlan must keep id and startedAt');
	}
	if (kept.planId !== 'plan-b' || kept.planName !== 'B') {
		throw new Error('replaceSessionPlan must adopt new plan meta');
	}
	if (kept.exercises.length !== 2) throw new Error('replaceSessionPlan exercise count');
	const bench = kept.exercises[0]!;
	if (bench.exerciseId !== 'bench' || bench.sets.filter((s) => s.completed).length !== 1) {
		throw new Error('replaceSessionPlan must keep completed overlap sets');
	}
	if (bench.sets.length !== 4 || bench.note !== 'pause') {
		throw new Error('replaceSessionPlan must pad to new target and keep note');
	}
	if (kept.exercises[1]?.exerciseId !== 'row' || kept.exercises.some((e) => e.exerciseId === 'fly')) {
		throw new Error('replaceSessionPlan must drop non-overlap and add new slots');
	}

	const dupPlan: WorkoutPlan = {
		id: 'plan-dup',
		name: 'Dup',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'bench', sets: 2, reps: 5, restSec: 60 },
			{ exerciseId: 'bench', sets: 2, reps: 5, restSec: 60 }
		]
	};
	const dupSession: WorkoutSession = {
		id: 's-dup',
		planId: 'old',
		planName: 'Old',
		startedAt: '2026-01-01T10:00:00.000Z',
		finishedAt: null,
		exercises: [
			{
				exerciseId: 'bench',
				targetSets: 2,
				targetReps: 5,
				restSec: 60,
				sets: [
					{ weightKg: 50, reps: 5, completed: true, kind: 'work' },
					{ weightKg: null, reps: 5, completed: false, kind: 'work' }
				]
			},
			{
				exerciseId: 'bench',
				targetSets: 2,
				targetReps: 5,
				restSec: 60,
				sets: [
					{ weightKg: 55, reps: 5, completed: true, kind: 'work' },
					{ weightKg: null, reps: 5, completed: false, kind: 'work' }
				]
			}
		]
	};
	const dup = replaceSessionPlan(dupSession, dupPlan);
	if (dup.exercises[0]?.sets[0]?.weightKg !== 50 || dup.exercises[1]?.sets[0]?.weightKg !== 55) {
		throw new Error('replaceSessionPlan must match duplicate exerciseIds in order');
	}
}
function pruneSkippedEmpty(session: WorkoutSession): WorkoutSession {
	const exercises = session.exercises
		.filter((ex) => !ex.skipped || ex.sets.some((s) => s.completed))
		.map(({ skipped: _skipped, ...ex }) => ex);
	return { ...session, exercises };
}

export function finishSession(session: WorkoutSession): WorkoutSession {
	if (session.finishedAt) return session;
	return {
		...pruneSkippedEmpty(pruneUnchosenAlts(session)),
		finishedAt: new Date().toISOString()
	};
}
export function mergeWorkoutSessions(
	local: WorkoutSession[],
	cloud: WorkoutSession[],
	deletedIds: Iterable<string> = []
): WorkoutSession[] {
	const deleted = new Set(
		[...deletedIds].map((id) => id.trim()).filter((id) => id.length > 0)
	);
	const map = new Map<string, WorkoutSession>();
	for (const session of local) {
		if (deleted.has(session.id)) continue;
		map.set(session.id, session);
	}
	for (const session of cloud) {
		if (deleted.has(session.id)) continue;
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
function clampInt(n: number, min: number, max: number): number {
	if (!Number.isFinite(n)) return min;
	return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Builder draft from a session: visible exercises only (chosen “or” slots),
 * sets/reps from what was logged (else targets).
 */
export function planDraftFromSession(session: WorkoutSession): WorkoutPlan {
	const ts = new Date().toISOString();
	const exercises: WorkoutExercise[] = [];
	for (const i of visibleSessionExerciseIndices(session)) {
		const ex = session.exercises[i];
		if (!ex) continue;
		const logged = ex.sets.filter((s) => s.completed);
		const setCount = logged.length > 0 ? logged.length : ex.targetSets;
		const lastReps = [...logged].reverse().find((s) => s.reps != null)?.reps;
		const reps = lastReps ?? ex.targetReps;
		exercises.push({
			exerciseId: ex.exerciseId,
			sets: clampInt(setCount > 0 ? setCount : DEFAULT_SETS, SETS.min, SETS.max),
			reps: clampInt(reps > 0 ? reps : DEFAULT_REPS, REPS.min, REPS.max),
			restSec: clampInt(
				ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC,
				REST_SEC.min,
				REST_SEC.max
			),
			groupId: ex.groupId ?? null,
			altGroupId: null
		});
	}
	return {
		id: newId(),
		name: session.planName.trim(),
		createdAt: ts,
		updatedAt: ts,
		exercises
	};
}

export function sessionDurationMs(session: WorkoutSession): number | null {
	const end = session.finishedAt ?? null;
	if (!end) return null;
	const ms = new Date(end).getTime() - new Date(session.startedAt).getTime();
	if (!Number.isFinite(ms) || ms < 0) return null;
	return ms;
}

/**
 * Whole minutes for list meta. Null when the duration is missing or below a
 * minute - callers must hide the chip instead of printing "0 мин" / "- мин".
 */
export function sessionDurationMinutes(session: WorkoutSession): number | null {
	const ms = sessionDurationMs(session);
	if (ms == null) return null;
	const minutes = Math.round(ms / 60_000);
	return minutes >= 1 ? minutes : null;
}
