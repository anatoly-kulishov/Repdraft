import type { SyncListKey } from '$lib/domain/cacheFreshness';

const PREFIX = 'repdraft:sync-at:';

function keyFor(listKey: SyncListKey): string {
	return `${PREFIX}${listKey}`;
}

export function readLastSyncedAt(listKey: SyncListKey): number | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(keyFor(listKey));
		if (!raw) return null;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? n : null;
	} catch {
		return null;
	}
}

export function writeLastSyncedAt(listKey: SyncListKey, at = Date.now()): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(keyFor(listKey), String(at));
	} catch {
		/* quota / private mode */
	}
}

export function clearLastSyncedAt(listKey: SyncListKey): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(keyFor(listKey));
	} catch {
		/* ignore */
	}
}

export function clearAllLastSyncedAt(): void {
	clearLastSyncedAt('plans');
	clearLastSyncedAt('records');
	clearLastSyncedAt('sessions');
}
