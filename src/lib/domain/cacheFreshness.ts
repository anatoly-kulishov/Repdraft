/** Cloud list is fresh enough to skip another fetch. */
export const CLOUD_FRESH_MS = 5 * 60 * 1000;

/** Keep serving local lists; do not wipe UI for “stale” before this. */
export const LOCAL_CACHE_KEEP_MS = 24 * 60 * 60 * 1000;

export type SyncListKey = 'plans' | 'records' | 'sessions';

export function isCloudFresh(lastSyncedAt: number | null, now = Date.now()): boolean {
	return lastSyncedAt != null && now - lastSyncedAt < CLOUD_FRESH_MS;
}

/** Local cache is still young enough that we must not discard it. */
export function shouldKeepLocalCache(lastSyncedAt: number | null, now = Date.now()): boolean {
	if (lastSyncedAt == null) return true;
	return now - lastSyncedAt < LOCAL_CACHE_KEEP_MS;
}
