import { browser } from '$app/environment';
import { duplicatePlan, withSavedName } from '$lib/domain/workout';
import type { WorkoutPlan } from '$lib/domain/types';
import { withTimeout } from '$lib/domain/withTimeout';
import { getWorkoutRepo, isCloudMode } from '$lib/storage/dataAccess';
import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';
import { writable, get } from 'svelte/store';
import { draft } from './draft';

const CLOUD_MS = 4000;

function createPlansStore() {
	const store = writable<WorkoutPlan[]>([]);
	const ready = writable(false);
	let inflight: Promise<void> | null = null;

	async function refresh() {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		if (inflight) return inflight;

		inflight = (async () => {
			try {
				const local = await localWorkoutRepository.list();
				if (local.length > 0) store.set(local);
				ready.set(true);

				if (isCloudMode()) {
					try {
						const cloud = await withTimeout(supabaseWorkoutRepository.list(), CLOUD_MS);
						store.set(cloud);
					} catch (err) {
						console.warn('plans cloud refresh failed', err);
						if (local.length === 0) store.set([]);
					}
				} else {
					store.set(local);
				}
			} catch (err) {
				console.error('plans.refresh failed', err);
				store.set([]);
			} finally {
				ready.set(true);
				inflight = null;
			}
		})();

		return inflight;
	}

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
		refresh,
		async saveCurrent(): Promise<WorkoutPlan> {
			const current = withSavedName(get(draft));
			await getWorkoutRepo().save(current);
			await localWorkoutRepository.save(current);
			draft.loadPlanIntoDraft(current);
			await refresh();
			return current;
		},
		async removePlan(id: string) {
			await getWorkoutRepo().remove(id);
			await localWorkoutRepository.remove(id);
			await refresh();
		},
		async duplicate(id: string): Promise<WorkoutPlan | null> {
			const plan =
				get(store).find((p) => p.id === id) ??
				(await localWorkoutRepository.get(id)) ??
				(await getWorkoutRepo().get(id));
			if (!plan) return null;
			const copy = duplicatePlan(plan);
			await getWorkoutRepo().save(copy);
			await localWorkoutRepository.save(copy);
			await refresh();
			return copy;
		},
		async getPlan(id: string): Promise<WorkoutPlan | null> {
			const cached = get(store).find((p) => p.id === id);
			if (cached) return cached;
			const local = await localWorkoutRepository.get(id);
			if (local) return local;
			try {
				return await withTimeout(getWorkoutRepo().get(id), CLOUD_MS);
			} catch {
				return null;
			}
		}
	};
}

export const plans = createPlansStore();
export const plansReady = { subscribe: plans.ready.subscribe };
