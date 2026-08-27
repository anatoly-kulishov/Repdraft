import { browser } from '$app/environment';
import { writable } from 'svelte/store';

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
	const { subscribe, set } = writable<string | null>(readPinnedPlanId());

	return {
		subscribe,
		pin(planId: string) {
			set(planId);
			writePinnedPlanId(planId);
		},
		clear() {
			set(null);
			writePinnedPlanId(null);
		}
	};
}

export const homeNextPlan = createHomeNextPlanStore();
