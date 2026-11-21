import { browser } from '$app/environment';
import {
	CYCLE_STORAGE_KEY,
	normalizeCycle,
	parseCycleStorage,
	serializeCycleStorage,
	type Mesocycle
} from '$lib/domain/cycle';
import { get, writable } from 'svelte/store';

function readCycle(): Mesocycle | null {
	if (!browser) return null;
	try {
		return parseCycleStorage(localStorage.getItem(CYCLE_STORAGE_KEY));
	} catch {
		return null;
	}
}

/** Local-only state: a cycle follows the device, like the athlete profile. */
function writeCycle(cycle: Mesocycle | null): void {
	if (!browser) return;
	try {
		if (cycle) localStorage.setItem(CYCLE_STORAGE_KEY, serializeCycleStorage(cycle));
		else localStorage.removeItem(CYCLE_STORAGE_KEY);
	} catch {
		/* Storage full / private mode: keep the in-memory cycle for this session. */
	}
}

function createCycleStore() {
	const store = writable<Mesocycle | null>(readCycle());
	const { subscribe, set } = store;

	return {
		subscribe,
		save(next: Mesocycle) {
			const normalized = normalizeCycle(next) ?? next;
			set(normalized);
			writeCycle(normalized);
		},
		patch(patch: Partial<Omit<Mesocycle, 'id'>>) {
			const prev = get(store);
			if (!prev) return;
			const normalized = normalizeCycle({ ...prev, ...patch });
			if (!normalized) return;
			set(normalized);
			writeCycle(normalized);
		},
		reset() {
			set(null);
			writeCycle(null);
		},
		/** Re-read storage (after backup import / dev wipe). */
		reload() {
			set(readCycle());
		}
	};
}

export const cycle = createCycleStore();
