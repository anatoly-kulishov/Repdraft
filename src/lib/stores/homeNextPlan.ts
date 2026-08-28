import { browser } from '$app/environment';
import { advanceHomeNextPlanId } from '$lib/domain/workout';
import { get, writable } from 'svelte/store';

export const HOME_NEXT_PLAN_STORAGE_KEY = 'repdraft:home-next-plan-id';

function readPinnedPlanId(): string | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(HOME_NEXT_PLAN_STORAGE_KEY);
		return raw && raw.length > 0 ? raw : null;
	} catch {
		return null;
	}
}

function writePinnedPlanId(planId: string | null) {
	if (!browser) return;
	try {
		if (planId) localStorage.setItem(HOME_NEXT_PLAN_STORAGE_KEY, planId);
		else localStorage.removeItem(HOME_NEXT_PLAN_STORAGE_KEY);
	} catch {
		/* ignore */
	}
}

function createHomeNextPlanStore() {
	const store = writable<string | null>(readPinnedPlanId());
	const { subscribe, set } = store;

	return {
		subscribe,
		pin(planId: string) {
			set(planId);
			writePinnedPlanId(planId);
		},
		clear() {
			set(null);
			writePinnedPlanId(null);
		},
		advanceAfterFinish(finishedPlanId: string, plans: { id: string }[]) {
			const nextId = advanceHomeNextPlanId(plans, finishedPlanId, get(store));
			if (nextId) {
				set(nextId);
				writePinnedPlanId(nextId);
			} else {
				set(null);
				writePinnedPlanId(null);
			}
		}
	};
}

export const homeNextPlan = createHomeNextPlanStore();
