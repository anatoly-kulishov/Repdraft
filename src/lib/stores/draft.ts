import { browser } from '$app/environment';
import {
	addExercise,
	createEmptyDraft,
	convertAltGroupToSuperset as convertAltGroupToSupersetInPlan,
	dissolveOrGroup as dissolveOrGroupInPlan,
	dissolveSuperset as dissolveSupersetInPlan,
	formOrGroup as formOrGroupInPlan,
	formSuperset as formSupersetInPlan,
	moveExercise as moveExerciseInPlan,
	moveByArrow as moveByArrowInPlan,
	moveWithinGroup as moveWithinGroupInPlan,
	insertExerciseAt as insertExerciseAtInPlan,
	removeExercise as removeExerciseFromPlan,
	updateExercise as updateExerciseInPlan,
	updateGroupRest as updateGroupRestInPlan,
	updateGroupSets as updateGroupSetsInPlan,
	type AddExerciseResult,
	type ExerciseRestHint
} from '$lib/domain/workout';
import type { WorkoutExercise, WorkoutPlan, WorkoutSession } from '$lib/domain/types';
import { planDraftFromSession } from '$lib/domain/session';
import { readDraft, writeDraft } from '$lib/storage/localWorkoutRepository';
import { clampPlanName } from '$lib/domain/inputLimits';
import { writable } from 'svelte/store';

/**
 * SSR + first client paint use an empty draft so HTML matches.
 * Real localStorage draft is applied in `hydrate()` (layout onMount) — avoids name/list jumps.
 */
function createDraftStore() {
	const { subscribe, set, update } = writable<WorkoutPlan>(createEmptyDraft());
	const hydratedStore = writable(false);
	let persist = false;

	if (browser) {
		subscribe((plan) => {
			if (!persist) return;
			writeDraft(plan);
		});
	}

	return {
		subscribe,
		hydrated: {
			subscribe: hydratedStore.subscribe
		},
		hydrate() {
			if (!browser) {
				hydratedStore.set(true);
				return;
			}
			const stored = readDraft();
			if (stored) set(stored);
			persist = true;
			hydratedStore.set(true);
		},
		set,
		update,
		addToDraft(exerciseId: string, hint?: ExerciseRestHint): AddExerciseResult {
			let result: AddExerciseResult = { plan: createEmptyDraft(), added: false };
			update((plan) => {
				result = addExercise(plan, exerciseId, hint);
				return result.plan;
			});
			// Do not bump exerciseStats here — it reshuffles catalog sections under the finger.
			// Uses are recorded when a live session finishes (live store).
			return result;
		},
		removeFromDraft(exerciseId: string) {
			update((plan) => removeExerciseFromPlan(plan, exerciseId));
		},
		restoreExerciseToDraft(exercise: WorkoutExercise, index: number) {
			update((plan) => insertExerciseAtInPlan(plan, exercise, index));
		},
		updateExercise(exerciseId: string, patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>) {
			update((plan) => updateExerciseInPlan(plan, exerciseId, patch));
		},
		moveExercise(fromIndex: number, toIndex: number) {
			update((plan) => moveExerciseInPlan(plan, fromIndex, toIndex));
		},
		moveByArrow(fromIndex: number, direction: -1 | 1) {
			update((plan) => moveByArrowInPlan(plan, fromIndex, direction));
		},
		moveWithinGroup(fromIndex: number, toIndex: number) {
			update((plan) => moveWithinGroupInPlan(plan, fromIndex, toIndex));
		},
		formSuperset(exerciseIds: string[]) {
			update((plan) => formSupersetInPlan(plan, exerciseIds));
		},
		dissolveSuperset(groupId: string) {
			update((plan) => dissolveSupersetInPlan(plan, groupId));
		},
		formOrGroup(exerciseIds: string[]) {
			update((plan) => formOrGroupInPlan(plan, exerciseIds));
		},
		dissolveOrGroup(altGroupId: string) {
			update((plan) => dissolveOrGroupInPlan(plan, altGroupId));
		},
		convertAltToSuperset(altGroupId: string) {
			update((plan) => convertAltGroupToSupersetInPlan(plan, altGroupId));
		},
		updateGroupSets(groupId: string, sets: number) {
			update((plan) => updateGroupSetsInPlan(plan, groupId, sets));
		},
		updateGroupRest(groupId: string, restSec: number) {
			update((plan) => updateGroupRestInPlan(plan, groupId, restSec));
		},
		setName(name: string) {
			update((plan) => ({ ...plan, name: clampPlanName(name) }));
		},
		resetDraft() {
			set(createEmptyDraft());
		},
		loadPlanIntoDraft(plan: WorkoutPlan) {
			set({
				...plan,
				name: clampPlanName(plan.name),
				exercises: plan.exercises.map((ex) => ({ ...ex }))
			});
		},
		loadSessionIntoDraft(session: WorkoutSession) {
			set(planDraftFromSession(session));
		}
	};
}

export const draft = createDraftStore();

/** True after local draft has been read (or SSR no-op). */
export const draftHydrated = {
	subscribe: draft.hydrated.subscribe
};
