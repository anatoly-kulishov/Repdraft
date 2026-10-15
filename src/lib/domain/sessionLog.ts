import {
	NOTE_MAX,
	LIVE_REPS,
	SETS,
	WEIGHT_KG,
	clampStoredWeightKg,
	sanitizeNote
} from './inputLimits';
import type { LastPerformance, LoggedSet, SetKind, WorkoutSession } from './types';
import { loggedSetKind } from './sessionSetKind';

export function updateLoggedSet(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number,
	patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'completed' | 'kind'>>
): WorkoutSession {
	const cleaned: typeof patch = { ...patch };
	if ('weightKg' in cleaned && cleaned.weightKg !== undefined) {
		if (cleaned.weightKg === null) {
			/* clear */
		} else if (!Number.isFinite(cleaned.weightKg)) {
			cleaned.weightKg = null;
		} else {
			cleaned.weightKg = clampStoredWeightKg(cleaned.weightKg);
		}
	}
	if ('reps' in cleaned && cleaned.reps !== undefined) {
		if (cleaned.reps === null) {
			/* clear */
		} else if (!Number.isFinite(cleaned.reps)) {
			cleaned.reps = null;
		} else {
			cleaned.reps = Math.min(
				LIVE_REPS.max,
				Math.max(LIVE_REPS.min, Math.round(cleaned.reps))
			);
		}
	}
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		const sets = ex.sets.map((s, si) => (si === setIndex ? { ...s, ...cleaned } : s));
		return { ...ex, sets };
	});
	return { ...session, exercises };
}

/** Persist optional exercise note (empty clears the field). */
export function updateExerciseNote(
	session: WorkoutSession,
	exerciseIndex: number,
	note: string
): WorkoutSession {
	const cleaned = sanitizeNote(note, NOTE_MAX);
	const current = session.exercises[exerciseIndex];
	if (!current) return session;
	const prev = current.note ?? '';
	if (cleaned === prev) return session;
	if (!cleaned && current.note === undefined) return session;
	const exercises = session.exercises.map((ex, ei) => {
		if (ei !== exerciseIndex) return ex;
		if (!cleaned) {
			const { note: _drop, ...rest } = ex;
			return rest;
		}
		return { ...ex, note: cleaned };
	});
	return { ...session, exercises };
}

/** Copy weight onto every incomplete set that differs (gym: same load all sets). */
export function applyWeightToOpenSets(
	session: WorkoutSession,
	exerciseIndex: number,
	weightKg: number
): WorkoutSession {
	const clamped =
		Number.isFinite(weightKg) ? clampStoredWeightKg(weightKg) : WEIGHT_KG.min;
	const ex = session.exercises[exerciseIndex];
	if (!ex) return session;
	let next = session;
	for (let si = 0; si < ex.sets.length; si++) {
		const set = ex.sets[si]!;
		if (set.completed || set.weightKg === clamped) continue;
		next = updateLoggedSet(next, exerciseIndex, si, { weightKg: clamped });
	}
	return next;
}

/** Copy reps onto every incomplete set that differs (gym: same target all sets).
 * Explicit tap flattens a ladder / scheme — same as the weight fill button. */
export function applyRepsToOpenSets(
	session: WorkoutSession,
	exerciseIndex: number,
	reps: number
): WorkoutSession {
	const clamped = Number.isFinite(reps)
		? Math.min(LIVE_REPS.max, Math.max(LIVE_REPS.min, Math.round(reps)))
		: LIVE_REPS.min;
	const ex = session.exercises[exerciseIndex];
	if (!ex) return session;
	let next = session;
	for (let si = 0; si < ex.sets.length; si++) {
		const set = ex.sets[si]!;
		if (set.completed || set.reps === clamped) continue;
		next = updateLoggedSet(next, exerciseIndex, si, { reps: clamped });
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
		if (ex.sets.length >= SETS.max) return ex;
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
		const openReps = new Set(ex.sets.filter((s) => !s.completed).map((s) => s.reps));
		const mixedOpenReps = openReps.size > 1;
		let setChanged = false;
		const sets = ex.sets.map((s) => {
			if (s.completed) return s;
			const weightKg = s.weightKg ?? last.weightKg ?? null;
			const reps =
				mixedOpenReps || last.reps == null ? s.reps : last.reps;
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
