import { isCloudFresh, type SyncListKey } from '$lib/domain/cacheFreshness';
import type { CloudListRefreshResult } from '$lib/domain/cloudSync';
import { withTimeout } from '$lib/domain/withTimeout';
import { isCloudMode } from '$lib/storage/dataAccess';
import { readLastSyncedAt, writeLastSyncedAt } from '$lib/storage/syncMeta';
import { enqueueOutbox, type SyncOutboxEntry } from '$lib/storage/syncOutbox';

export type { CloudListRefreshResult, CloudSyncState } from '$lib/domain/cloudSync';
export { isCloudListUncertain } from '$lib/domain/cloudSync';

const CLOUD_MS = 4000;

export async function refreshLocalCloudList<T>(opts: {
	localList: () => Promise<T[]>;
	cloudList: () => Promise<T[]>;
	merge: (local: T[], cloud: T[]) => T[];
	wantCloud?: boolean;
	/** Skip cloud when last successful sync was within CLOUD_FRESH_MS. */
	listKey?: SyncListKey;
	/** Keep showing these while loading local / cloud (never flash empty). */
	previousItems?: T[];
	/** Ignore freshness TTL (e.g. CloudSyncBanner retry). */
	forceCloud?: boolean;
	label: string;
	onUpdate?: (result: CloudListRefreshResult<T>) => void;
}): Promise<CloudListRefreshResult<T>> {
	const emit = (result: CloudListRefreshResult<T>) => opts.onUpdate?.(result);
	const previous = opts.previousItems;

	if (previous && previous.length > 0) {
		emit({ items: previous, state: 'loading' });
	}

	const local = await opts.localList();
	const cloudActive = opts.wantCloud !== false && isCloudMode();

	if (!cloudActive) {
		const result: CloudListRefreshResult<T> = { items: local, state: 'synced' };
		emit(result);
		return result;
	}

	// Skip cloud only when we already have local rows. Empty local + fresh stamp
	// used to flash an empty UI after reload (cloud merge never mirrored to localStorage).
	if (
		local.length > 0 &&
		opts.listKey &&
		!opts.forceCloud &&
		isCloudFresh(readLastSyncedAt(opts.listKey))
	) {
		const result: CloudListRefreshResult<T> = { items: local, state: 'synced' };
		emit(result);
		return result;
	}

	emit({ items: local, state: 'stale' });

	try {
		const cloud = await withTimeout(opts.cloudList(), CLOUD_MS);
		const result: CloudListRefreshResult<T> = {
			items: opts.merge(local, cloud),
			state: 'synced'
		};
		if (opts.listKey) writeLastSyncedAt(opts.listKey);
		emit(result);
		return result;
	} catch (err) {
		console.warn(`${opts.label} cloud refresh failed`, err);
		// Keep local list (including under 24h policy) — never wipe on cloud error.
		const result: CloudListRefreshResult<T> = { items: local, state: 'error' };
		emit(result);
		return result;
	}
}

/** Local write always runs; returns whether cloud mirror succeeded (true if cloud off). */
export async function mirrorCloudWrite(opts: {
	localWrite: () => Promise<void>;
	cloudWrite?: () => Promise<void>;
	label: string;
	/** Enqueued when cloud mirror fails so reconnect can flush. */
	outboxOnFail?: SyncOutboxEntry;
}): Promise<boolean> {
	await opts.localWrite();
	if (!isCloudMode() || !opts.cloudWrite) return true;
	try {
		await withTimeout(opts.cloudWrite(), CLOUD_MS);
		return true;
	} catch (err) {
		console.warn(`${opts.label} cloud write failed`, err);
		if (opts.outboxOnFail) enqueueOutbox(opts.outboxOnFail);
		return false;
	}
}
