import type { WorkoutExercise, WorkoutPlan } from './types';
import { newId } from './id';

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_SEC = 90;

function nowIso(): string {
	return new Date().toISOString();
}

export function createEmptyDraft(): WorkoutPlan {
	const ts = nowIso();
	return {
		id: newId(),
		name: 'Новая тренировка',
		createdAt: ts,
		updatedAt: ts,
		exercises: []
	};
}

export type AddExerciseResult = {
	plan: WorkoutPlan;
	added: boolean;
};

export function addExercise(plan: WorkoutPlan, exerciseId: string): AddExerciseResult {
	if (plan.exercises.some((ex) => ex.exerciseId === exerciseId)) {
		return { plan, added: false };
	}

	const entry: WorkoutExercise = {
		exerciseId,
		sets: DEFAULT_SETS,
		reps: DEFAULT_REPS,
		restSec: DEFAULT_REST_SEC
	};

	return {
		plan: {
			...plan,
			updatedAt: nowIso(),
			exercises: [...plan.exercises, entry]
		},
		added: true
	};
}

export function removeExercise(plan: WorkoutPlan, exerciseId: string): WorkoutPlan {
	return {
		...plan,
		updatedAt: nowIso(),
		exercises: plan.exercises.filter((ex) => ex.exerciseId !== exerciseId)
	};
}

export function updateExercise(
	plan: WorkoutPlan,
	exerciseId: string,
	patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>
): WorkoutPlan {
	return {
		...plan,
		updatedAt: nowIso(),
		exercises: plan.exercises.map((ex) =>
			ex.exerciseId === exerciseId ? { ...ex, ...patch } : ex
		)
	};
}

export function moveExercise(plan: WorkoutPlan, fromIndex: number, toIndex: number): WorkoutPlan {
	if (
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= plan.exercises.length ||
		toIndex >= plan.exercises.length ||
		fromIndex === toIndex
	) {
		return plan;
	}

	const exercises = [...plan.exercises];
	const [item] = exercises.splice(fromIndex, 1);
	exercises.splice(toIndex, 0, item);

	return {
		...plan,
		updatedAt: nowIso(),
		exercises
	};
}

export function duplicatePlan(plan: WorkoutPlan): WorkoutPlan {
	const ts = nowIso();
	return {
		...plan,
		id: newId(),
		name: `${plan.name} (копия)`,
		createdAt: ts,
		updatedAt: ts,
		exercises: plan.exercises.map((ex) => ({ ...ex }))
	};
}

export function withSavedName(plan: WorkoutPlan): WorkoutPlan {
	const name = plan.name.trim() || 'Тренировка без названия';
	return {
		...plan,
		name,
		updatedAt: nowIso()
	};
}
