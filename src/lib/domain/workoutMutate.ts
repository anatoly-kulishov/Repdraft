import type { WorkoutExercise, WorkoutPlan } from './types';
import { newId } from './id';
import { REPS, REST_SEC, SETS } from './inputLimits';
import {
	DEFAULT_SETS,
	DEFAULT_REPS,
	DEFAULT_REST_SEC,
	defaultRestSecForExercise,
	normalizeRepsScheme,
	type ExerciseRestHint
} from './workoutDefaults';

export function nowIso(): string {
	return new Date().toISOString();
}

export function withUpdated(plan: WorkoutPlan, exercises: WorkoutExercise[]): WorkoutPlan {
	return { ...plan, updatedAt: nowIso(), exercises };
}

/** Drop groupId when fewer than 2 members remain; restore rest on orphans. */
function normalizeGroups(exercises: WorkoutExercise[]): WorkoutExercise[] {
	const counts = new Map<string, number>();
	for (const ex of exercises) {
		if (!ex.groupId) continue;
		counts.set(ex.groupId, (counts.get(ex.groupId) ?? 0) + 1);
	}
	return exercises.map((ex) => {
		if (!ex.groupId) return ex;
		if ((counts.get(ex.groupId) ?? 0) >= 2) return ex;
		return {
			...ex,
			groupId: null,
			restSec: ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC
		};
	});
}

/** Drop altGroupId when fewer than 2 members remain. */
function normalizeAltGroups(exercises: WorkoutExercise[]): WorkoutExercise[] {
	const counts = new Map<string, number>();
	for (const ex of exercises) {
		if (!ex.altGroupId) continue;
		counts.set(ex.altGroupId, (counts.get(ex.altGroupId) ?? 0) + 1);
	}
	return exercises.map((ex) => {
		if (!ex.altGroupId) return ex;
		if ((counts.get(ex.altGroupId) ?? 0) >= 2) return ex;
		return { ...ex, altGroupId: null };
	});
}

export function normalizePlanExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
	return normalizeAltGroups(normalizeGroups(exercises));
}

export function applyRoundRest(members: WorkoutExercise[]): WorkoutExercise[] {
	return members.map((ex, i) => ({
		...ex,
		restSec: i === members.length - 1 ? (ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC) : 0
	}));
}

export function createEmptyDraft(defaultName = ''): WorkoutPlan {
	const ts = nowIso();
	return {
		id: newId(),
		name: defaultName,
		createdAt: ts,
		updatedAt: ts,
		exercises: []
	};
}

export type AddExerciseResult = {
	plan: WorkoutPlan;
	added: boolean;
};

export function addExercise(
	plan: WorkoutPlan,
	exerciseId: string,
	hint?: ExerciseRestHint
): AddExerciseResult {
	if (plan.exercises.some((ex) => ex.exerciseId === exerciseId)) {
		return { plan, added: false };
	}

	const entry: WorkoutExercise = {
		exerciseId,
		sets: DEFAULT_SETS,
		reps: DEFAULT_REPS,
		restSec: defaultRestSecForExercise(hint)
	};

	return {
		plan: withUpdated(plan, [...plan.exercises, entry]),
		added: true
	};
}

export function removeExercise(plan: WorkoutPlan, exerciseId: string): WorkoutPlan {
	const exercises = normalizePlanExercises(
		plan.exercises.filter((ex) => ex.exerciseId !== exerciseId)
	);
	return withUpdated(plan, exercises);
}

/** Undo remove: re-insert the full row (sets, groups) at its prior index. */
export function insertExerciseAt(
	plan: WorkoutPlan,
	exercise: WorkoutExercise,
	index: number
): WorkoutPlan {
	if (plan.exercises.some((ex) => ex.exerciseId === exercise.exerciseId)) return plan;
	const exercises = [...plan.exercises];
	const at = Math.min(Math.max(0, index), exercises.length);
	exercises.splice(at, 0, { ...exercise });
	return withUpdated(plan, normalizePlanExercises(exercises));
}

export function updateExercise(
	plan: WorkoutPlan,
	exerciseId: string,
	patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>
): WorkoutPlan {
	const { groupId: _g, altGroupId: _a, ...safePatch } = patch;
	const clamped: typeof safePatch = { ...safePatch };
	if (clamped.sets != null) {
		const n = Math.round(clamped.sets);
		clamped.sets = Number.isFinite(n)
			? Math.min(SETS.max, Math.max(SETS.min, n))
			: SETS.min;
	}
	if (clamped.reps != null) {
		const n = Math.round(clamped.reps);
		clamped.reps = Number.isFinite(n)
			? Math.min(REPS.max, Math.max(REPS.min, n))
			: REPS.min;
	}
	if (clamped.restSec != null) {
		const n = Math.round(clamped.restSec);
		clamped.restSec = Number.isFinite(n)
			? Math.min(REST_SEC.max, Math.max(REST_SEC.min, n))
			: REST_SEC.min;
	}

	const patchingScheme = Object.prototype.hasOwnProperty.call(patch, 'repsScheme');
	if (patchingScheme) {
		const normalized =
			clamped.repsScheme == null ? null : normalizeRepsScheme(clamped.repsScheme);
		if (!normalized) {
			clamped.repsScheme = undefined;
		} else {
			clamped.repsScheme = normalized;
			clamped.sets = normalized.length;
			clamped.reps = normalized[0]!;
		}
	}

	const clearsScheme =
		!patchingScheme && (patch.sets != null || patch.reps != null);

	return withUpdated(
		plan,
		plan.exercises.map((ex) => {
			if (ex.exerciseId !== exerciseId) return ex;
			const merged: WorkoutExercise = { ...ex, ...clamped };
			if (patchingScheme && clamped.repsScheme === undefined) {
				const { repsScheme: _drop, ...rest } = merged;
				return rest;
			}
			if (clearsScheme && merged.repsScheme) {
				const { repsScheme: _drop, ...rest } = merged;
				return rest;
			}
			return merged;
		})
	);
}

/** Keep sets and rest. No-op if the target id is already in the plan. */
export function replacePlanExercise(
	plan: WorkoutPlan,
	fromExerciseId: string,
	toExerciseId: string
): WorkoutPlan {
	if (fromExerciseId === toExerciseId) return plan;
	if (!plan.exercises.some((ex) => ex.exerciseId === fromExerciseId)) return plan;
	if (plan.exercises.some((ex) => ex.exerciseId === toExerciseId)) return plan;
	return withUpdated(
		plan,
		plan.exercises.map((ex) =>
			ex.exerciseId === fromExerciseId ? { ...ex, exerciseId: toExerciseId } : ex
		)
	);
}
