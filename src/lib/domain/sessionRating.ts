/**
 * Post-session rating (1–5 stars). Local-only on purpose: `workout_sessions`
 * has no rating column yet, and a silent cloud drop would look like data loss.
 * Storage lives under its own key, so a later migration to a DB column can
 * replay it without touching session sync.
 */

export const SESSION_RATINGS_STORAGE_KEY = 'repdraft:session-ratings';

export type SessionRating = 1 | 2 | 3 | 4 | 5;

export const SESSION_RATING_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly SessionRating[];

export type SessionRatingEntry = { stars: SessionRating; at: string };

export type SessionRatings = Record<string, SessionRatingEntry>;

export function isSessionRating(value: unknown): value is SessionRating {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= 5 &&
		(SESSION_RATING_VALUES as readonly number[]).includes(value)
	);
}

function isEntry(value: unknown): value is SessionRatingEntry {
	if (!value || typeof value !== 'object') return false;
	const entry = value as { stars?: unknown; at?: unknown };
	return isSessionRating(entry.stars) && typeof entry.at === 'string' && entry.at.length > 0;
}

/** Tolerant parse: unknown shapes are dropped, never thrown. */
export function parseSessionRatings(raw: unknown): SessionRatings {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const result: SessionRatings = {};
	for (const [sessionId, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!sessionId.trim()) continue;
		if (isEntry(value)) result[sessionId] = { stars: value.stars, at: value.at };
	}
	return result;
}

export function ratingFor(ratings: SessionRatings, sessionId: string): SessionRating | null {
	return ratings[sessionId]?.stars ?? null;
}

export function runSessionRatingSelfCheck(): void {
	const ratings = parseSessionRatings({
		a: { stars: 4, at: '2026-01-01T10:00:00.000Z' },
		b: { stars: 9, at: '2026-01-01T10:00:00.000Z' },
		c: { stars: 3 },
		d: 'nope',
		'': { stars: 5, at: '2026-01-01T10:00:00.000Z' }
	});
	if (Object.keys(ratings).join() !== 'a') throw new Error('sessionRating: parse filters');
	if (ratingFor(ratings, 'a') !== 4) throw new Error('sessionRating: ratingFor');
	if (ratingFor(ratings, 'zzz') !== null) throw new Error('sessionRating: missing is null');
	if (parseSessionRatings(null) && Object.keys(parseSessionRatings(null)).length !== 0) {
		throw new Error('sessionRating: null -> empty');
	}
	if (Object.keys(parseSessionRatings([1, 2])).length !== 0) {
		throw new Error('sessionRating: array -> empty');
	}

	if (!isSessionRating(5) || isSessionRating(0) || isSessionRating(6) || isSessionRating('5')) {
		throw new Error('sessionRating: guard');
	}
}
