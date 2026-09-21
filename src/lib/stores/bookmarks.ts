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
	/** Invalidates in-flight refresh after local writes (undo vs toggle race). */
	let writeEpoch = 0;

	function bumpWriteEpoch() {
		writeEpoch += 1;
	}

	async function refresh() {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		if (inflight) await inflight;
		const seen = writeEpoch;
		let run: Promise<void> = Promise.resolve();
		run = (async () => {
			try {
				const ids = await localBookmarkRepository.list();
				if (seen !== writeEpoch) return;
				store.set(ids);
				syncBookmarksCountCookie(ids.length);
			} catch {
				if (seen !== writeEpoch) return;
				const ids = peekLocalBookmarkIds();
				store.set(ids);
				syncBookmarksCountCookie(ids.length);
			} finally {
				ready.set(true);
				if (inflight === run) inflight = null;
			}
		})();
		inflight = run;
		return run;
	}

	function invalidate() {
		bumpWriteEpoch();
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
			bumpWriteEpoch();
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
		},
		/** Undo unbookmark: put id back at the index it had before delete. */
		async restoreAt(exerciseId: string, index: number): Promise<void> {
			const without = get(store).filter((id) => id !== exerciseId);
			const at = Math.max(0, Math.min(index < 0 ? without.length : index, without.length));
			const next = [...without.slice(0, at), exerciseId, ...without.slice(at)];
			bumpWriteEpoch();
			store.set(next);
			syncBookmarksCountCookie(next.length);
			try {
				await localBookmarkRepository.replaceAll(next);
			} catch {
				await refresh();
				throw new Error('BOOKMARK_TOGGLE_FAILED');
			}
		}
	};
}

export const bookmarks = createBookmarksStore();
export const bookmarksReady = { subscribe: bookmarks.ready.subscribe };
