import { localCacheUserAction } from '$lib/domain/localCacheUser';
import {
	ACTIVE_SESSION_KEY,
	BOOKMARKS_STORAGE_KEY,
	DRAFT_STORAGE_KEY,
	PLANS_STORAGE_KEY,
	RECORDS_STORAGE_KEY,
	SESSIONS_STORAGE_KEY
} from '$lib/domain/repository';

export const LOCAL_CACHE_USER_KEY = 'repdraft:local-cache-user';

const USER_DATA_KEYS = [
	RECORDS_STORAGE_KEY,
	PLANS_STORAGE_KEY,
	DRAFT_STORAGE_KEY,
	SESSIONS_STORAGE_KEY,
	ACTIVE_SESSION_KEY,
	BOOKMARKS_STORAGE_KEY
] as const;

export function clearUserLocalData(): void {
	if (typeof localStorage === 'undefined') return;
	for (const key of USER_DATA_KEYS) {
		localStorage.removeItem(key);
	}
}

/** Keep guest local data on first login; wipe on logout or account switch. */
export function syncLocalCacheUser(userId: string | null): { changed: boolean; cleared: boolean } {
	if (typeof localStorage === 'undefined') return { changed: false, cleared: false };

	const cached = localStorage.getItem(LOCAL_CACHE_USER_KEY);
	const cachedNorm = cached?.trim() || null;
	const { action, shouldClear } = localCacheUserAction(cachedNorm, userId);

	if (action === 'noop') return { changed: false, cleared: false };

	if (shouldClear) clearUserLocalData();

	if (userId) localStorage.setItem(LOCAL_CACHE_USER_KEY, userId);
	else localStorage.removeItem(LOCAL_CACHE_USER_KEY);

	return { changed: true, cleared: shouldClear };
}
