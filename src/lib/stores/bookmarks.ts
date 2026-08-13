import { browser } from '$app/environment';
import { localBookmarkRepository } from '$lib/storage/localBookmarkRepository';
import { get, writable } from 'svelte/store';

function createBookmarksStore() {
	const store = writable<string[]>([]);
	const ready = writable(false);

	async function refresh() {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		try {
			store.set(await localBookmarkRepository.list());
		} catch {
			store.set([]);
		} finally {
			ready.set(true);
		}
	}

	function invalidate() {
		store.set([]);
		ready.set(false);
	}

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
		invalidate,
		refresh,
		has(exerciseId: string): boolean {
			return get(store).includes(exerciseId);
		},
		async toggle(exerciseId: string): Promise<boolean> {
			const was = get(store).includes(exerciseId);
			const optimistic = was
				? get(store).filter((id) => id !== exerciseId)
				: [exerciseId, ...get(store).filter((id) => id !== exerciseId)];
			store.set(optimistic);
			try {
				if (was) {
					await localBookmarkRepository.remove(exerciseId);
				} else {
					await localBookmarkRepository.add(exerciseId);
				}
				await refresh();
				return !was;
			} catch {
				await refresh();
				throw new Error('BOOKMARK_TOGGLE_FAILED');
			}
		}
	};
}

export const bookmarks = createBookmarksStore();
