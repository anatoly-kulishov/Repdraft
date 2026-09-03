import { browser } from '$app/environment';
import { localBookmarkRepository, peekLocalBookmarkIds } from '$lib/storage/localBookmarkRepository';
import { syncBookmarksCountCookie } from '$lib/storage/listBootPeek';
import { get, writable } from 'svelte/store';

function createBookmarksStore() {
	/** Client peek is sync and authoritative for empty-vs-list; refresh keeps store fresh. */
	const initial = browser ? peekLocalBookmarkIds() : [];
	if (browser) syncBookmarksCountCookie(initial.length);
	const store = writable<string[]>(initial);
	const ready = writable(browser);
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
				const ids = await localBookmarkRepository.list();
				store.set(ids);
				syncBookmarksCountCookie(ids.length);
			} catch {
				const ids = peekLocalBookmarkIds();
				store.set(ids);
				syncBookmarksCountCookie(ids.length);
			} finally {
				ready.set(true);
				inflight = null;
			}
		})();
		return inflight;
	}

	function invalidate() {
		store.set(browser ? peekLocalBookmarkIds() : []);
		ready.set(browser);
		if (browser) void refresh();
	}

	if (browser) void refresh();

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
export const bookmarksReady = { subscribe: bookmarks.ready.subscribe };
