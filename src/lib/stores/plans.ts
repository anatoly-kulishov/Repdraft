import { browser } from '$app/environment';
import { duplicatePlan, withSavedName } from '$lib/domain/workout';
import type { WorkoutPlan } from '$lib/domain/types';
import { getWorkoutRepo } from '$lib/storage/dataAccess';
import { writable, get } from 'svelte/store';
import { draft } from './draft';

function createPlansStore() {
	const { subscribe, set } = writable<WorkoutPlan[]>([]);

	async function refresh() {
		if (!browser) {
			set([]);
			return;
		}
		try {
			const list = await getWorkoutRepo().list();
			set(list);
		} catch (err) {
			console.error('plans.refresh failed', err);
			set([]);
		}
	}

	return {
		subscribe,
		refresh,
		async saveCurrent(): Promise<WorkoutPlan> {
			const current = withSavedName(get(draft));
			await getWorkoutRepo().save(current);
			draft.loadPlanIntoDraft(current);
			await refresh();
			return current;
		},
		async removePlan(id: string) {
			await getWorkoutRepo().remove(id);
			await refresh();
		},
		async duplicate(id: string): Promise<WorkoutPlan | null> {
			const plan = await getWorkoutRepo().get(id);
			if (!plan) return null;
			const copy = duplicatePlan(plan);
			await getWorkoutRepo().save(copy);
			await refresh();
			return copy;
		},
		async getPlan(id: string): Promise<WorkoutPlan | null> {
			return getWorkoutRepo().get(id);
		}
	};
}

export const plans = createPlansStore();
