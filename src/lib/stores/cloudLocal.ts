import { isCloudFresh, type SyncListKey } from '$lib/domain/cacheFreshness';
import type { CloudListRefreshResult } from '$lib/domain/cloudSync';
import type { RepdraftExportPayload } from '$lib/domain/exportData';
import { CLOUD_REQUEST_MS } from '$lib/domain/networkTimeouts';
import { withTimeout } from '$lib/domain/withTimeout';
import { isCloudMode, isSessionsCloudAvailable } from '$lib/storage/dataAccess';
import { readLastSyncedAt, writeLastSyncedAt } from '$lib/storage/syncMeta';
import { enqueueOutbox, type SyncOutboxEntry } from '$lib/storage/syncOutbox';
import { supabaseRecordRepository } from '$lib/storage/supabaseRecordRepository';
import { supabaseSessionRepository } from '$lib/storage/supabaseSessionRepository';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';

export type { CloudListRefreshResult, CloudSyncState } from '$lib/domain/cloudSync';
export { isCloudListUncertain } from '$lib/domain/cloudSync';

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
		const cloud = await withTimeout(opts.cloudList(), CLOUD_REQUEST_MS);
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
		await withTimeout(opts.cloudWrite(), CLOUD_REQUEST_MS);
		return true;
	} catch (err) {
		console.warn(`${opts.label} cloud write failed`, err);
		if (opts.outboxOnFail) enqueueOutbox(opts.outboxOnFail);
		return false;
	}
}

/** Upsert backup rows to cloud after JSON import (local is already saved). */
export async function syncImportedPayloadToCloud(payload: RepdraftExportPayload): Promise<boolean> {
	if (!isCloudMode()) return true;

	let allOk = true;
	const noop = async () => {};

	for (const plan of payload.plans) {
		const ok = await mirrorCloudWrite({
			localWrite: noop,
			cloudWrite: () => supabaseWorkoutRepository.save(plan),
			label: 'import.plan',
			outboxOnFail: { kind: 'plan.save', id: plan.id }
		});
		if (!ok) allOk = false;
	}

	for (const record of payload.records) {
		const ok = await mirrorCloudWrite({
			localWrite: noop,
			cloudWrite: () => supabaseRecordRepository.save(record),
			label: 'import.record',
			outboxOnFail: { kind: 'record.save', exerciseId: record.exerciseId }
		});
		if (!ok) allOk = false;
	}

	if (isSessionsCloudAvailable()) {
		for (const session of payload.sessions) {
			const ok = await mirrorCloudWrite({
				localWrite: noop,
				cloudWrite: () => supabaseSessionRepository.save(session),
				label: 'import.session',
				outboxOnFail: { kind: 'session.save', id: session.id }
			});
			if (!ok) allOk = false;
		}
	}

	return allOk;
}
