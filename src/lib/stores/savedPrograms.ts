import { browser } from '$app/environment';
import {
	parseSavedPrograms,
	SAVED_PROGRAMS_STORAGE_KEY
} from '$lib/domain/programs';
import { get, writable } from 'svelte/store';

/**
 * Local-only «save for the next block» marks on the program hub. Public content
 * stays account-free, so the mark lives on the device, like program runs.
 */
function createSavedProgramsStore() {
	/** Empty on purpose: SSR/prerender has no localStorage; `hydrate()` fills it. */
	const store = writable<string[]>([]);

	function write(next: string[]): void {
		if (!browser) return;
		try {
			localStorage.setItem(SAVED_PROGRAMS_STORAGE_KEY, JSON.stringify(next));
		} catch {
			/* quota / private mode: losing a mark beats breaking the page */
		}
	}

	return {
		subscribe: store.subscribe,
		hydrate() {
			if (!browser) return;
			try {
				store.set(parseSavedPrograms(JSON.parse(localStorage.getItem(SAVED_PROGRAMS_STORAGE_KEY) ?? '[]')));
			} catch {
				store.set([]);
			}
		},
		has(slug: string): boolean {
			return get(store).includes(slug);
		},
		/** Returns true when the program is now saved. */
		toggle(slug: string): boolean {
			const current = get(store);
			const saved = !current.includes(slug);
			const next = parseSavedPrograms(
				saved ? [slug, ...current] : current.filter((item) => item !== slug)
			);
			store.set(next);
			write(next);
			return saved;
		}
	};
}

export const savedPrograms = createSavedProgramsStore();
