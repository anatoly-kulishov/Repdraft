import { browser } from '$app/environment';
import {
	SESSION_RATINGS_STORAGE_KEY,
	parseSessionRatings,
	type SessionRating,
	type SessionRatings
} from '$lib/domain/sessionRating';
import { writable } from 'svelte/store';

function readStored(): SessionRatings {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(SESSION_RATINGS_STORAGE_KEY);
		if (!raw) return {};
		return parseSessionRatings(JSON.parse(raw) as unknown);
	} catch {
		return {};
	}
}

function writeStored(ratings: SessionRatings): void {
	if (!browser) return;
	try {
		localStorage.setItem(SESSION_RATINGS_STORAGE_KEY, JSON.stringify(ratings));
	} catch {
		/* quota / private mode: a lost rating is not worth breaking the summary */
	}
}

function createSessionRatingsStore() {
	const store = writable<SessionRatings>({});

	return {
		subscribe: store.subscribe,
		hydrate() {
			if (!browser) return;
			store.set(readStored());
		},
		rate(sessionId: string, stars: SessionRating) {
			if (!browser || !sessionId) return;
			store.update((current) => {
				const next: SessionRatings = {
					...current,
					[sessionId]: { stars, at: new Date().toISOString() }
				};
				writeStored(next);
				return next;
			});
		},
	};
}

export const sessionRatings = createSessionRatingsStore();
