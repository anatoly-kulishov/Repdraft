import { browser } from '$app/environment';
import { listExerciseIdsWithPublicClips } from '$lib/storage/techniqueClipsRepository';
import { isSupabaseConfigured } from '$lib/supabase/client';
import { get, writable } from 'svelte/store';

const STORAGE_KEY = 'repdraft.technique-clip-hints';

function readCachedIds(): Set<string> {
	if (!browser) return new Set();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
	} catch {
		return new Set();
	}
}

function writeCachedIds(ids: ReadonlySet<string>) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
	} catch {
		/* ignore quota */
	}
}

function createTechniqueClipHintsStore() {
	const store = writable<ReadonlySet<string>>(new Set());
	const ready = writable(false);
	let inflight: Promise<void> | null = null;

	function hydrate() {
		if (!browser) {
			store.set(new Set());
			ready.set(true);
			return;
		}
		store.set(readCachedIds());
		ready.set(true);
	}

	async function refresh() {
		if (!browser || !isSupabaseConfigured()) return;
		while (inflight) await inflight;
		const run = (async () => {
			try {
				const ids = await listExerciseIdsWithPublicClips();
				const next = new Set(ids);
				store.set(next);
				writeCachedIds(next);
			} catch (err) {
				console.warn('techniqueClipHints.refresh failed', err);
			}
		})();
		inflight = run;
		try {
			await run;
		} finally {
			if (inflight === run) inflight = null;
		}
	}

	function setExerciseHasClips(exerciseId: string, has: boolean) {
		store.update((current) => {
			const next = new Set(current);
			if (has) next.add(exerciseId);
			else next.delete(exerciseId);
			writeCachedIds(next);
			return next;
		});
	}

	function has(exerciseId: string): boolean {
		return get(store).has(exerciseId);
	}

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
		hydrate,
		refresh,
		setExerciseHasClips,
		has
	};
}

export const techniqueClipHints = createTechniqueClipHintsStore();
