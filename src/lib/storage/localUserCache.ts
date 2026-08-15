import { localCacheUserAction } from '$lib/domain/localCacheUser';
import {
	ACTIVE_SESSION_KEY,
	BOOKMARKS_STORAGE_KEY,
	DRAFT_STORAGE_KEY,
	PLANS_STORAGE_KEY,
	RECORDS_STORAGE_KEY,
	REST_UNTIL_STORAGE_KEY,
	SESSIONS_STORAGE_KEY
} from '$lib/domain/repository';

export const LOCAL_CACHE_USER_KEY = 'repdraft:local-cache-user';

const USER_DATA_KEYS = [
	RECORDS_STORAGE_KEY,
	PLANS_STORAGE_KEY,
	DRAFT_STORAGE_KEY,
	SESSIONS_STORAGE_KEY,
	ACTIVE_SESSION_KEY,
	BOOKMARKS_STORAGE_KEY,
	REST_UNTIL_STORAGE_KEY
] as const;

/** Legacy local greeting-name keys from pre–cloud-first builds. */
const LEGACY_GREETING_NAME_PREFIX = 'repdraft:greeting-name:';

function clearLegacyGreetingNameKeys(): void {
	if (typeof localStorage === 'undefined') return;
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(LEGACY_GREETING_NAME_PREFIX)) keys.push(key);
	}
	for (const key of keys) localStorage.removeItem(key);
}

export function clearUserLocalData(): void {
	if (typeof localStorage === 'undefined') return;
	for (const key of USER_DATA_KEYS) {
		localStorage.removeItem(key);
	}
	clearLegacyGreetingNameKeys();
}

/** Keep guest local data on first login; wipe on logout or account switch. */
export function syncLocalCacheUser(userId: string | null): {
	changed: boolean;
	cleared: boolean;
	action: import('$lib/domain/localCacheUser').LocalCacheUserAction;
} {
	if (typeof localStorage === 'undefined') {
		return { changed: false, cleared: false, action: 'noop' };
	}

	const cached = localStorage.getItem(LOCAL_CACHE_USER_KEY);
	const cachedNorm = cached?.trim() || null;
	const { action, shouldClear } = localCacheUserAction(cachedNorm, userId);

	if (action === 'noop') return { changed: false, cleared: false, action };

	if (shouldClear) clearUserLocalData();

	if (userId) localStorage.setItem(LOCAL_CACHE_USER_KEY, userId);
	else localStorage.removeItem(LOCAL_CACHE_USER_KEY);

	return { changed: true, cleared: shouldClear, action };
}
