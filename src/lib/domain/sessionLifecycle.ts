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
