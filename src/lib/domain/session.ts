import { newId } from './id';
import { REPS, REST_SEC, SETS } from './inputLimits';
import type {
	LastPerformance,
	LoggedSet,
	SessionExercise,
	SetKind,
	WorkoutExercise,
	WorkoutPlan,
	WorkoutSession
} from './types';
import { DEFAULT_REPS, DEFAULT_REST_SEC, DEFAULT_SETS, groupBounds, altGroupBounds } from './workout';

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
		altChoices: {},
		exercises: plan.exercises.map(
			(ex): SessionExercise => ({
				exerciseId: ex.exerciseId,
				groupId: ex.groupId ?? null,
				altGroupId: ex.altGroupId ?? null,
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

/** Indices that participate in live logging (skip non-chosen “or” members). */
export function visibleSessionExerciseIndices(session: WorkoutSession): number[] {
	const choices = session.altChoices ?? {};
	const out: number[] = [];
	let i = 0;
	const list = session.exercises;
	while (i < list.length) {
		const ex = list[i];
		if (ex?.skipped) {
			i += 1;
			continue;
		}
		const ab = altGroupBounds(list, i);
		if (ab && ab.start === i && ab.end > ab.start) {
			const chosenId = choices[ab.altGroupId];
			if (chosenId) {
				const idx = list.findIndex(
					(item, ei) =>
						ei >= ab.start && ei <= ab.end && item.exerciseId === chosenId && !item.skipped
				);
				out.push(idx >= 0 ? idx : ab.start);
			} else {
				out.push(ab.start);
			}
			i = ab.end + 1;
			continue;
		}
		out.push(i);
		i += 1;
	}
	return out;
}

export function altGroupNeedsPick(session: WorkoutSession, exerciseIndex: number): boolean {
	const ab = altGroupBounds(session.exercises, exerciseIndex);
	if (!ab || ab.start === ab.end) return false;
	return !(session.altChoices ?? {})[ab.altGroupId];
}

export function chooseAltExercise(
	session: WorkoutSession,
	altGroupId: string,
	exerciseId: string
): WorkoutSession {
	const members = session.exercises.filter((ex) => ex.altGroupId === altGroupId);
	if (!members.some((ex) => ex.exerciseId === exerciseId)) return session;
	const prev = (session.altChoices ?? {})[altGroupId];
	if (prev === exerciseId) return session;
	const prevEx = prev ? members.find((ex) => ex.exerciseId === prev) : null;
	if (prevEx?.sets.some((s) => s.completed)) return session;
	return {
		...session,
		altChoices: { ...(session.altChoices ?? {}), [altGroupId]: exerciseId }
	};
}

/** Drop unchosen “or” members before history write. */
export function pruneUnchosenAlts(session: WorkoutSession): WorkoutSession {
	const choices = session.altChoices ?? {};
	const exercises = session.exercises.filter((ex) => {
		if (!ex.altGroupId) return true;
		const chosen = choices[ex.altGroupId];
		if (!chosen) {
			return ex.sets.some((s) => s.completed);
		}
		return ex.exerciseId === chosen;
	});
	return { ...session, exercises, altChoices: undefined };
}

function nextVisibleAfterIndex(session: WorkoutSession, fromIndex: number): number | null {
	const visible = visibleSessionExerciseIndices(session);
	const pos = visible.indexOf(fromIndex);
	if (pos >= 0 && pos + 1 < visible.length) return visible[pos + 1]!;
	return visible.find((i) => i > fromIndex) ?? null;
}

/** First visible exercise after a contiguous superset / block. */
function nextVisibleAfterGroupEnd(session: WorkoutSession, groupEnd: number): number {
	return nextVisibleAfterIndex(session, groupEnd) ?? groupEnd;
}

function isVisibleSessionExercise(session: WorkoutSession, index: number): boolean {
	return visibleSessionExerciseIndices(session).includes(index);
}

function nextIncompleteInGroup(
	session: WorkoutSession,
	bounds: { start: number; end: number },
	fromIndex: number
): number | null {
	for (let i = fromIndex + 1; i <= bounds.end; i++) {
		if (!isVisibleSessionExercise(session, i)) continue;
		const ex = session.exercises[i];
		if (ex?.sets.some((s) => !s.completed)) return i;
	}
	for (let i = bounds.start; i < fromIndex; i++) {
		if (!isVisibleSessionExercise(session, i)) continue;
		const ex = session.exercises[i];
		if (ex?.sets.some((s) => !s.completed)) return i;
	}
	return null;
}

/**
 * “Next exercise” button: stay inside an open incomplete superset; otherwise always
 * advance to the next visible exercise (user intent — even if current sets are open).
 */
export function nextManualExerciseFocus(session: WorkoutSession, exerciseIndex: number): number {
	const bounds = groupBounds(session.exercises, exerciseIndex);
	if (bounds && bounds.start !== bounds.end) {
		const inside = nextIncompleteInGroup(session, bounds, exerciseIndex);
		if (inside != null) return inside;
		return nextVisibleAfterGroupEnd(session, bounds.end);
	}

	const next = nextVisibleAfterIndex(session, exerciseIndex);
	if (next != null) return next;
	return exerciseIndex;
}

/**
 * After completing set `setIndex` on `exerciseIndex`, pick the next exercise to focus.
 * Supersets go round-robin (A1 → B1 → C1 → A2…); solos advance when all sets are done.
 */
export function nextFocusAfterSetComplete(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number
): number {
	const bounds = groupBounds(session.exercises, exerciseIndex);
	if (bounds && bounds.start !== bounds.end) {
		for (let i = exerciseIndex + 1; i <= bounds.end; i++) {
			if (!isVisibleSessionExercise(session, i)) continue;
			const set = session.exercises[i]?.sets[setIndex];
			if (set && !set.completed) return i;
		}
		for (let i = bounds.start; i < exerciseIndex; i++) {
			if (!isVisibleSessionExercise(session, i)) continue;
			const set = session.exercises[i]?.sets[setIndex];
			if (set && !set.completed) return i;
		}
		for (let s = setIndex + 1; ; s++) {
			let sawSlot = false;
			for (let i = bounds.start; i <= bounds.end; i++) {
				if (!isVisibleSessionExercise(session, i)) continue;
				const set = session.exercises[i]?.sets[s];
				if (!set) continue;
				sawSlot = true;
				if (!set.completed) return i;
			}
			if (!sawSlot) break;
		}
		return nextVisibleAfterGroupEnd(session, bounds.end);
	}

	const ex = session.exercises[exerciseIndex];
	if (ex && ex.sets.length > 0 && ex.sets.every((s) => s.completed)) {
		const next = nextVisibleAfterIndex(session, exerciseIndex);
		if (next != null) return next;
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

/** Copy weight onto every incomplete set that differs (gym: same load all sets). */
export function applyWeightToOpenSets(
	session: WorkoutSession,
	exerciseIndex: number,
	weightKg: number
): WorkoutSession {
	const ex = session.exercises[exerciseIndex];
	if (!ex) return session;
	let next = session;
	for (let si = 0; si < ex.sets.length; si++) {
		const set = ex.sets[si]!;
		if (set.completed || set.weightKg === weightKg) continue;
		next = updateLoggedSet(next, exerciseIndex, si, { weightKg });
	}
	return next;
}

export function addLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	kind: SetKind = 'work'
): WorkoutSession {
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		const prev = ex.sets[ex.sets.length - 1];
		return {
			...ex,
			sets: [
				...ex.sets,
				{
					weightKg: prev?.weightKg ?? null,
					reps: prev?.reps ?? ex.targetReps,
					completed: false,
					kind
				}
			]
		};
	});
	return { ...session, exercises };
}

/**
 * Prefill incomplete sets from last finished performance (gym: no need to retype).
 * Leaves sets untouched when no history exists for that exercise.
 */
export function seedOpenSetsFromLastPerformance(
	session: WorkoutSession,
	getLast: (exerciseId: string) => LastPerformance | null
): WorkoutSession {
	let changed = false;
	const exercises = session.exercises.map((ex) => {
		const last = getLast(ex.exerciseId);
		if (!last || (last.weightKg == null && last.reps == null)) return ex;
		let setChanged = false;
		const sets = ex.sets.map((s) => {
			if (s.completed) return s;
			const weightKg = s.weightKg ?? last.weightKg ?? null;
			const reps = last.reps != null ? last.reps : s.reps;
			if (weightKg === s.weightKg && reps === s.reps) return s;
			setChanged = true;
			return { ...s, weightKg, reps };
		});
		if (!setChanged) return ex;
		changed = true;
		return { ...ex, sets };
	});
	return changed ? { ...session, exercises } : session;
}

/** History edit: append a completed set, copying the last logged load when present. */
export function addCompletedLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	kind: SetKind = 'work'
): WorkoutSession {
	const ex = session.exercises[exerciseIndex];
	if (!ex || ex.sets.length >= SETS.max) return session;
	const last = ex.sets[ex.sets.length - 1];
	const exercises = session.exercises.map((item, ei) => {
		if (ei !== exerciseIndex) return item;
		return {
			...item,
			sets: [
				...item.sets,
				{
					weightKg: last?.weightKg ?? null,
					reps: last?.reps ?? item.targetReps,
					completed: true,
					kind
				}
			]
		};
	});
	return { ...session, exercises };
}

/** Drop a logged set. Live keeps at least one row so the exercise stays loggable. */
export function removeLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number,
	options: { keepAtLeastOne?: boolean } = {}
): WorkoutSession {
	const keepAtLeastOne = options.keepAtLeastOne ?? true;
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		if (keepAtLeastOne && ex.sets.length <= 1) return ex;
		if (setIndex < 0 || setIndex >= ex.sets.length) return ex;
		return { ...ex, sets: ex.sets.filter((_, si) => si !== setIndex) };
	});
	return { ...session, exercises };
}

/** History edit: drop a logged exercise block. */
export function removeLoggedExercise(
	session: WorkoutSession,
	exerciseIndex: number,
	options: { keepAtLeastOne?: boolean } = {}
): WorkoutSession {
	const keepAtLeastOne = options.keepAtLeastOne ?? true;
	if (keepAtLeastOne && session.exercises.length <= 1) return session;
	if (exerciseIndex < 0 || exerciseIndex >= session.exercises.length) return session;
	return {
		...session,
		exercises: session.exercises.filter((_, ei) => ei !== exerciseIndex)
	};
}

/**
 * Live: drop an exercise when equipment/time changed.
 * No logged sets → remove; partial logs → mark skipped and keep completed sets only.
 */
export function skipSessionExercise(
	session: WorkoutSession,
	exerciseIndex: number
): WorkoutSession {
	const ex = session.exercises[exerciseIndex];
	if (!ex || ex.skipped) return session;
	const hasCompleted = ex.sets.some((s) => s.completed);
	if (!hasCompleted) {
		return removeLoggedExercise(session, exerciseIndex, { keepAtLeastOne: false });
	}
	const exercises = session.exercises.map((item, ei) => {
		if (ei !== exerciseIndex) return item;
		return {
			...item,
			skipped: true,
			sets: item.sets.filter((s) => s.completed)
		};
	});
	return { ...session, exercises };
}

function pruneSkippedEmpty(session: WorkoutSession): WorkoutSession {
	const exercises = session.exercises
		.filter((ex) => !ex.skipped || ex.sets.some((s) => s.completed))
		.map(({ skipped: _skipped, ...ex }) => ex);
	return { ...session, exercises };
}

export function finishSession(session: WorkoutSession): WorkoutSession {
	return {
		...pruneSkippedEmpty(pruneUnchosenAlts(session)),
		finishedAt: new Date().toISOString()
	};
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
		for (const set of ex.sets) {
			if (!set.completed || set.weightKg == null || set.reps == null) continue;
			total += set.weightKg * set.reps;
		}
	}
	return total;
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
	if (sessionVolumeKg(session) !== 320) {
		throw new Error(`sessionVolumeKg expected 320, got ${sessionVolumeKg(session)}`);
	}

	session = finishSession(session);
	if (!session.finishedAt) throw new Error('finishSession should set finishedAt');

	if (!isSessionFullyLogged(updateLoggedSet(startSessionFromPlan(plan), 0, 0, { completed: true }))) {
		/* one set done of many — not fully logged */
	}
	const almost = startSessionFromPlan(plan);
	let full = almost;
	for (let ei = 0; ei < almost.exercises.length; ei++) {
		const sets = almost.exercises[ei]!.sets;
		for (let si = 0; si < sets.length; si++) {
			full = updateLoggedSet(full, ei, si, { weightKg: 10, reps: 8, completed: true });
		}
	}
	if (!isSessionFullyLogged(full)) {
		throw new Error('isSessionFullyLogged should be true when all sets done');
	}

	const last = lastPerformance([session], 'ex-a');
	if (!last || last.weightKg !== 40 || last.reps !== 8 || last.sets !== 1) {
		throw new Error(`lastPerformance unexpected ${JSON.stringify(last)}`);
	}

	const seeded = seedOpenSetsFromLastPerformance(startSessionFromPlan(plan), (id) =>
		id === 'ex-a' ? last : null
	);
	const seededSet = seeded.exercises[0]?.sets[0];
	if (seededSet?.weightKg !== 40 || seededSet.reps !== 8) {
		throw new Error(`seedOpenSetsFromLastPerformance unexpected ${JSON.stringify(seededSet)}`);
	}
	const unseeded = seedOpenSetsFromLastPerformance(startSessionFromPlan(plan), () => null);
	if (unseeded.exercises[0]?.sets[0]?.weightKg != null) {
		throw new Error('seed without history should leave weight empty');
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

	const draftPlan = planDraftFromSession(session);
	if (draftPlan.name !== 'Push') throw new Error('planDraftFromSession name');
	const draftExA = draftPlan.exercises.find((ex) => ex.exerciseId === 'ex-a');
	if (!draftExA || draftExA.sets !== 1 || draftExA.reps !== 8) {
		throw new Error(`planDraftFromSession sets/reps unexpected ${JSON.stringify(draftExA)}`);
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
	const emptied = removeLoggedSet(onlyOne, 0, 0, { keepAtLeastOne: false });
	if (emptied.exercises[0]!.sets.length !== 0) {
		throw new Error('removeLoggedSet keepAtLeastOne:false should allow empty');
	}
	const withCompleted = addCompletedLoggedSet(onlyOne, 0);
	const added = withCompleted.exercises[0]!.sets.at(-1);
	if (
		withCompleted.exercises[0]!.sets.length !== 2 ||
		!added?.completed ||
		added.weightKg !== 40 ||
		added.reps !== 8
	) {
		throw new Error(`addCompletedLoggedSet unexpected ${JSON.stringify(added)}`);
	}
	const droppedEx = removeLoggedExercise(session, 1);
	if (droppedEx.exercises.length !== session.exercises.length - 1) {
		throw new Error('removeLoggedExercise should drop one exercise');
	}
	if (removeLoggedExercise(onlyOne, 0).exercises.length !== 1) {
		throw new Error('removeLoggedExercise must keep at least one exercise');
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

	const triplePlan: WorkoutPlan = {
		id: 'p3',
		name: 'Triple SS',
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-08-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'ex-a', sets: 3, reps: 10, restSec: 0, groupId: 'g3' },
			{ exerciseId: 'ex-b', sets: 3, reps: 10, restSec: 0, groupId: 'g3' },
			{ exerciseId: 'ex-c', sets: 3, reps: 10, restSec: 90, groupId: 'g3' },
			{ exerciseId: 'ex-solo', sets: 2, reps: 8, restSec: 60 }
		]
	};
	let tri = startSessionFromPlan(triplePlan);
	tri = updateLoggedSet(tri, 0, 0, { reps: 10, completed: true });
	if (nextFocusAfterSetComplete(tri, 0, 0) !== 1) {
		throw new Error('triple superset should advance A1 → B1');
	}
	tri = updateLoggedSet(tri, 1, 0, { reps: 10, completed: true });
	if (nextFocusAfterSetComplete(tri, 1, 0) !== 2) {
		throw new Error('triple superset should advance B1 → C1');
	}
	tri = updateLoggedSet(tri, 2, 0, { reps: 10, completed: true });
	if (nextFocusAfterSetComplete(tri, 2, 0) !== 0) {
		throw new Error('triple superset should advance C1 → A2');
	}
	// Out-of-order C1 while A1/B1 still open — wrap same round, not skip to round 2.
	tri = startSessionFromPlan(triplePlan);
	tri = updateLoggedSet(tri, 2, 0, { reps: 10, completed: true });
	if (nextFocusAfterSetComplete(tri, 2, 0) !== 0) {
		throw new Error('triple superset should wrap C1 → A1 when round open');
	}
	if (nextManualExerciseFocus(tri, 2) !== 0) {
		throw new Error('manual next from last superset slot should stay in block');
	}
	tri = startSessionFromPlan(triplePlan);
	for (const [ei, si] of [
		[0, 0],
		[1, 0],
		[2, 0],
		[0, 1],
		[1, 1],
		[2, 1],
		[0, 2],
		[1, 2],
		[2, 2]
	] as const) {
		tri = updateLoggedSet(tri, ei, si, { reps: 10, completed: true });
	}
	if (nextManualExerciseFocus(tri, 2) !== 3) {
		throw new Error('manual next after finished superset should leave block');
	}
	// Explicit Next must advance solo even with open sets (button is unlocked on purpose).
	const soloOpen = startSessionFromPlan(plan);
	if (nextManualExerciseFocus(soloOpen, 0) !== 1) {
		throw new Error('manual next should leave incomplete solo for next visible exercise');
	}
	if (nextManualExerciseFocus(soloOpen, 1) !== 1) {
		throw new Error('manual next on last visible should stay put');
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
	const gated = mergeWorkoutSessions([older], [newer, { ...warm, id: 'cloud-only' }], [
		'cloud-only',
		'merge-old'
	]);
	if (gated.length !== 0) {
		throw new Error('mergeWorkoutSessions should honor deletion tombstones');
	}

	let skipPlan = startSessionFromPlan(groupedPlan);
	if (skipSessionExercise(skipPlan, 1).exercises.length !== 2) {
		throw new Error('skipSessionExercise should remove exercise with no logs');
	}
	skipPlan = startSessionFromPlan(groupedPlan);
	skipPlan = updateLoggedSet(skipPlan, 1, 0, { reps: 12, completed: true });
	const partialSkip = skipSessionExercise(skipPlan, 1);
	if (
		!partialSkip.exercises[1]?.skipped ||
		partialSkip.exercises[1]?.sets.length !== 1 ||
		visibleSessionExerciseIndices(partialSkip).includes(1)
	) {
		throw new Error('skipSessionExercise should mark partial skip and hide from visible');
	}
	skipPlan = startSessionFromPlan(groupedPlan);
	for (const ei of [0, 2]) {
		for (let si = 0; si < 2; si++) {
			skipPlan = updateLoggedSet(skipPlan, ei, si, { reps: 10, completed: true });
		}
	}
	const readySkip = skipSessionExercise(skipPlan, 1);
	if (readySkip.exercises.length !== 2 || !isSessionFullyLogged(readySkip)) {
		throw new Error('skipSessionExercise should allow finish when remaining work is done');
	}
	const finishedSkip = finishSession(partialSkip);
	if (
		finishedSkip.exercises.some((ex) => ex.skipped) ||
		finishedSkip.exercises.find((ex) => ex.exerciseId === 'ex-b')?.sets.length !== 1
	) {
		throw new Error('finishSession should keep partial skip logs without skipped flag');
	}

	let fillPlan = startSessionFromPlan(plan);
	fillPlan = updateLoggedSet(fillPlan, 0, 0, { weightKg: 12, reps: 10 });
	const filled = applyWeightToOpenSets(fillPlan, 0, 12);
	if (filled.exercises[0]?.sets.some((s, si) => si > 0 && s.weightKg !== 12)) {
		throw new Error('applyWeightToOpenSets should fill open sets');
	}
	fillPlan = updateLoggedSet(fillPlan, 0, 1, { weightKg: 12, reps: 10, completed: true });
	const skipDone = applyWeightToOpenSets(fillPlan, 0, 60);
	if (skipDone.exercises[0]?.sets[1]?.weightKg !== 12) {
		throw new Error('applyWeightToOpenSets should not touch completed sets');
	}
}
