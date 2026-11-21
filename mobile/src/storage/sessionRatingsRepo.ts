import {
	SESSION_RATINGS_STORAGE_KEY,
	parseSessionRatings,
	type SessionRating
} from '@repdraft/domain/sessionRating';
import { kvGetJson, kvSetJson } from './kv';

async function readAll() {
	return parseSessionRatings(await kvGetJson<unknown>(SESSION_RATINGS_STORAGE_KEY, {}));
}

/** Same storage shape as the web store, so a later DB migration can replay both. */
export const sessionRatingsRepo = {
	async get(sessionId: string): Promise<SessionRating | null> {
		if (!sessionId) return null;
		return (await readAll())[sessionId]?.stars ?? null;
	},
	async set(sessionId: string, stars: SessionRating): Promise<void> {
		if (!sessionId) return;
		const all = await readAll();
		all[sessionId] = { stars, at: new Date().toISOString() };
		await kvSetJson(SESSION_RATINGS_STORAGE_KEY, all);
	}
};
