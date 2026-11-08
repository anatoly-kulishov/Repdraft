import {
	NOTE_MAX,
	LIVE_REPS,
	SETS,
	WEIGHT_KG,
	clampStoredWeightKg,
	sanitizeNote
} from './inputLimits';
import { visibleSessionExerciseIndices } from './sessionAlts';
import type {
	LastPerformance,
	LoggedSet,
	SessionExercise,
	SetKind,
	WorkoutSession
} from './types';
import { loggedSetKind } from './sessionSetKind';
import { DEFAULT_REPS, DEFAULT_REST_SEC, DEFAULT_SETS } from './workoutDefaults';

export type NewSessionExerciseOpts = {
	sets?: number;
	reps?: number;
	restSec?: number;
};

function blankSessionExercise(
	exerciseId: string,
	opts: NewSessionExerciseOpts = {}
): SessionExercise {
	const sets = Math.max(1, opts.sets ?? DEFAULT_SETS);
	const reps = opts.reps ?? DEFAULT_REPS;
	const restSec = opts.restSec ?? DEFAULT_REST_SEC;
	return {
		exerciseId,
		groupId: null,
		altGroupId: null,
		targetSets: sets,
		targetReps: reps,
		restSec,
		sets: Array.from({ length: sets }, () => ({
			weightKg: null,
			reps,
			completed: false,
			kind: 'work' as const
		}))
	};
}

/** Insert a fresh exercise slot into a live session (after `atIndex - 1`). */
export function insertSessionExercise(
	session: WorkoutSession,
	atIndex: number,
	exerciseId: string,
	opts: NewSessionExerciseOpts = {}
): WorkoutSession {
	const id = exerciseId.trim();
	if (!id) return session;
	const i = Math.max(0, Math.min(Math.round(atIndex), session.exercises.length));
	const next = blankSessionExercise(id, opts);
	return {
		...session,
		exercises: [...session.exercises.slice(0, i), next, ...session.exercises.slice(i)]
	};
}

/**
 * Replace one live slot with another catalog exercise.
 * Drops logs/note for that slot; keeps target set count and groupId (superset).
 * Clears altGroupId so an “or” slot becomes a fixed exercise.
 */
export function replaceSessionExercise(
	session: WorkoutSession,
	exerciseIndex: number,
	exerciseId: string,
	opts: NewSessionExerciseOpts = {}
): WorkoutSession {
	const id = exerciseId.trim();
	const prev = session.exercises[exerciseIndex];
	if (!prev || !id) return session;
	if (prev.exerciseId === id) return session;

	const next = blankSessionExercise(id, {
		sets: opts.sets ?? prev.targetSets,
		reps: opts.reps ?? prev.targetReps,
		restSec: opts.restSec ?? prev.restSec
	});
	next.groupId = prev.groupId ?? null;

	const altChoices = { ...(session.altChoices ?? {}) };
	for (const [groupId, chosenId] of Object.entries(altChoices)) {
		if (chosenId === prev.exerciseId) delete altChoices[groupId];
	}

	return {
		...session,
		exercises: session.exercises.map((ex, ei) => (ei === exerciseIndex ? next : ex)),
		altChoices
	};
}

/** True when removing this visible slot would leave at least one other visible exercise. */
export function canRemoveSessionExercise(
	session: WorkoutSession,
	exerciseIndex: number
): boolean {
	const visible = visibleSessionExerciseIndices(session);
	return visible.length > 1 && visible.includes(exerciseIndex);
}

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

/** Throws if live insert/replace/remove guards regress. */
export function runSessionLogSelfCheck(): void {
	const base: WorkoutSession = {
		id: 's1',
		planId: 'p1',
		planName: 'P',
		startedAt: '2026-01-01T10:00:00.000Z',
		finishedAt: null,
		exercises: [
			{
				exerciseId: 'bench',
				targetSets: 3,
				targetReps: 8,
				restSec: 90,
				sets: [
					{ weightKg: 40, reps: 8, completed: true, kind: 'work' },
					{ weightKg: null, reps: 8, completed: false, kind: 'work' },
					{ weightKg: null, reps: 8, completed: false, kind: 'work' }
				]
			},
			{
				exerciseId: 'fly',
				targetSets: 3,
				targetReps: 12,
				restSec: 60,
				sets: [
					{ weightKg: null, reps: 12, completed: false, kind: 'work' },
					{ weightKg: null, reps: 12, completed: false, kind: 'work' },
					{ weightKg: null, reps: 12, completed: false, kind: 'work' }
				]
			}
		]
	};

	const replaced = replaceSessionExercise(base, 0, 'row');
	if (replaced.exercises[0]?.exerciseId !== 'row') {
		throw new Error('replaceSessionExercise must change exerciseId');
	}
	if (replaced.exercises[0]?.sets.some((s) => s.completed)) {
		throw new Error('replaceSessionExercise must drop previous logs');
	}
	if (replaced.exercises[0]?.targetSets !== 3) {
		throw new Error('replaceSessionExercise must keep target set count');
	}

	const inserted = insertSessionExercise(base, 1, 'curl');
	if (inserted.exercises.length !== 3 || inserted.exercises[1]?.exerciseId !== 'curl') {
		throw new Error('insertSessionExercise must insert at index');
	}

	if (!canRemoveSessionExercise(base, 0) || !canRemoveSessionExercise(base, 1)) {
		throw new Error('canRemoveSessionExercise should allow when 2+ visible');
	}
	const solo = { ...base, exercises: [base.exercises[0]!] };
	if (canRemoveSessionExercise(solo, 0)) {
		throw new Error('canRemoveSessionExercise must block last visible exercise');
	}
}
