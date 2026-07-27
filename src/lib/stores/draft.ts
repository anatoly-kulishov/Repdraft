import { browser } from '$app/environment';
import {
	addExercise,
	createEmptyDraft,
	moveExercise as moveExerciseInPlan,
	removeExercise as removeExerciseFromPlan,
	updateExercise as updateExerciseInPlan,
	type AddExerciseResult
} from '$lib/domain/workout';
import type { WorkoutExercise, WorkoutPlan } from '$lib/domain/types';
import { readDraft, writeDraft } from '$lib/storage/localWorkoutRepository';
import { writable } from 'svelte/store';

function initialDraft(): WorkoutPlan {
	if (!browser) return createEmptyDraft();
	return readDraft() ?? createEmptyDraft();
}

function createDraftStore() {
	const { subscribe, set, update } = writable<WorkoutPlan>(initialDraft());

	if (browser) {
		subscribe((plan) => {
			writeDraft(plan);
		});
	}

	return {
		subscribe,
		set,
		update,
		addToDraft(exerciseId: string): AddExerciseResult {
			let result: AddExerciseResult = { plan: createEmptyDraft(), added: false };
			update((plan) => {
				result = addExercise(plan, exerciseId);
				return result.plan;
			});
			return result;
		},
		removeFromDraft(exerciseId: string) {
			update((plan) => removeExerciseFromPlan(plan, exerciseId));
		},
		updateExercise(exerciseId: string, patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>) {
			update((plan) => updateExerciseInPlan(plan, exerciseId, patch));
		},
		moveExercise(fromIndex: number, toIndex: number) {
			update((plan) => moveExerciseInPlan(plan, fromIndex, toIndex));
		},
		setName(name: string) {
			update((plan) => ({ ...plan, name }));
		},
		resetDraft() {
			set(createEmptyDraft());
		},
		loadPlanIntoDraft(plan: WorkoutPlan) {
			set({
				...plan,
				exercises: plan.exercises.map((ex) => ({ ...ex }))
			});
		}
	};
}

export const draft = createDraftStore();
