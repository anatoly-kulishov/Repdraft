import { browser } from '$app/environment';
import {
	parseProgressPeriod,
	PROGRESS_PERIOD_STORAGE_KEY,
	type ProgressPeriod
} from '$lib/domain/progressOverview';
import { writable } from 'svelte/store';

/**
 * Shared, persisted progress window (7 / 30 / 90 / all). One value drives both
 * the Progress page and the Home summary cards, and it survives page reloads /
 * app restarts via localStorage.
 */
function bootPeriod(): ProgressPeriod {
	if (!browser) return 30;
	try {
		return parseProgressPeriod(localStorage.getItem(PROGRESS_PERIOD_STORAGE_KEY));
	} catch {
		return 30;
	}
}

const periodStore = writable<ProgressPeriod>(bootPeriod());

export const progressPeriod = {
	subscribe: periodStore.subscribe,
	set(next: ProgressPeriod) {
		periodStore.set(next);
		if (!browser) return;
		try {
			localStorage.setItem(PROGRESS_PERIOD_STORAGE_KEY, String(next));
		} catch {
			/* ignore */
		}
	},
	update: periodStore.update
};