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
import { clearAllLastSyncedAt } from '$lib/storage/syncMeta';
import { clearSyncOutbox } from '$lib/storage/syncOutbox';

export const LOCAL_CACHE_USER_KEY = 'repdraft:local-cache-user';

/** Sync peek for auth boot skeleton: true if last session was a signed-in user. */
export function peekLocalCacheUserId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(LOCAL_CACHE_USER_KEY)?.trim();
		return raw || null;
	} catch {
		return null;
	}
}

/**
 * Fallback when `repdraft:local-cache-user` is missing but Supabase still has a
 * persisted session (common after refresh before auth.init finishes).
 */
export function peekSupabaseStoredUserId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			const parsed: unknown = JSON.parse(raw);
			const id = readUserIdFromSupabaseAuthStorage(parsed);
			if (id) return id;
		}
	} catch {
		return null;
	}
	return null;
}

function readUserIdFromSupabaseAuthStorage(parsed: unknown): string | null {
	if (!parsed || typeof parsed !== 'object') return null;
	const root = parsed as Record<string, unknown>;
	const direct = root.user;
	if (direct && typeof direct === 'object') {
		const id = (direct as Record<string, unknown>).id;
		if (typeof id === 'string' && id.trim()) return id.trim();
	}
	const current = root.currentSession;
	if (current && typeof current === 'object') {
		const user = (current as Record<string, unknown>).user;
		if (user && typeof user === 'object') {
			const id = (user as Record<string, unknown>).id;
			if (typeof id === 'string' && id.trim()) return id.trim();
		}
	}
	return null;
}

/** Prefer app cache, then Supabase persisted session. */
export function peekLikelySignedInUserId(): string | null {
	return peekLocalCacheUserId() ?? peekSupabaseStoredUserId();
}

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
	clearAllLastSyncedAt();
	clearSyncOutbox();
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
