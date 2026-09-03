import { browser } from '$app/environment';
import {
	createEmptyRecord,
	hasLiftData,
	mergePersonalRecords,
	personalRecordContentEqual,
	sanitizePersonalRecord
} from '$lib/domain/records';
import type { PersonalRecord } from '$lib/domain/types';
import {
	localRecordRepository,
	peekLocalRecords,
	replaceAllRecords
} from '$lib/storage/localRecordRepository';
import { syncRecordsCountCookie } from '$lib/storage/listBootPeek';
import { clearLastSyncedAt } from '$lib/storage/syncMeta';
import { supabaseRecordRepository } from '$lib/storage/supabaseRecordRepository';
import type { CloudSyncState } from '$lib/domain/cloudSync';
import {
	mirrorCloudWrite,
	refreshLocalCloudList
} from '$lib/stores/cloudLocal';
import { isCloudMode } from '$lib/storage/dataAccess';
import { get, writable } from 'svelte/store';

function createRecordsStore() {
	/** Client peek is sync for empty-vs-list; cloud refresh may still fill an empty local list. */
	const initial = browser ? peekLocalRecords() : [];
	if (browser) syncRecordsCountCookie(initial.filter(hasLiftData).length);
	const store = writable<PersonalRecord[]>(initial);
	const ready = writable(browser);
	const sync = writable<CloudSyncState>(browser ? 'synced' : 'idle');
	let inflight: Promise<void> | null = null;

	function invalidate() {
		inflight = null;
		clearLastSyncedAt('records');
		store.set(browser ? peekLocalRecords() : []);
		sync.set(browser ? 'synced' : 'idle');
		ready.set(browser);
		if (browser) void refresh({ cloud: false });
	}

	async function refresh(opts?: { cloud?: boolean; force?: boolean }) {
		if (!browser) {
			store.set([]);
			sync.set('synced');
			ready.set(true);
			return;
		}
		while (inflight) await inflight;

		const wantCloud = opts?.cloud !== false;
		const forceCloud = opts?.force === true;

		const run = (async () => {
			try {
				const result = await refreshLocalCloudList({
					localList: () => localRecordRepository.list(),
					cloudList: () => supabaseRecordRepository.list(),
					merge: mergePersonalRecords,
					wantCloud,
					forceCloud,
					listKey: 'records',
					previousItems: get(store),
					label: 'records',
					onUpdate: (update) => {
						store.set(update.items);
						sync.set(update.state);
						syncRecordsCountCookie(update.items.filter(hasLiftData).length);
						if (update.state !== 'loading') ready.set(true);
					}
				});
				if (wantCloud && result.state === 'synced' && isCloudMode()) {
					replaceAllRecords(result.items);
				}
			} catch (err) {
				console.error('records.refresh failed', err);
				if (get(store).length === 0) store.set(peekLocalRecords());
				sync.set('error');
				ready.set(true);
			} finally {
				inflight = null;
			}
		})();

		inflight = run;
		return run;
	}

	if (browser) void refresh({ cloud: false });

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
		sync: { subscribe: sync.subscribe },
		invalidate,
		refresh,
		get(exerciseId: string): PersonalRecord | null {
			return get(store).find((r) => r.exerciseId === exerciseId) ?? null;
		},
		async save(record: PersonalRecord): Promise<boolean> {
			const sanitized = sanitizePersonalRecord({
				...record,
				updatedAt: new Date().toISOString()
			});
			if (!sanitized.ok) return false;
			const next = sanitized.record;
			const existing = get(store).find((r) => r.exerciseId === next.exerciseId);
			if (existing && personalRecordContentEqual(existing, next)) return true;
			const cloudOk = await mirrorCloudWrite({
				localWrite: () => localRecordRepository.save(next),
				cloudWrite: () => supabaseRecordRepository.save(next),
				label: 'records.save',
				outboxOnFail: { kind: 'record.save', exerciseId: next.exerciseId }
			});
			await refresh({ cloud: cloudOk && isCloudMode() });
			return true;
		},
		async remove(exerciseId: string) {
			const cloudOk = await mirrorCloudWrite({
				localWrite: () => localRecordRepository.remove(exerciseId),
				cloudWrite: () => supabaseRecordRepository.remove(exerciseId),
				label: 'records.remove',
				outboxOnFail: { kind: 'record.delete', exerciseId }
			});
			await refresh({ cloud: cloudOk && isCloudMode() });
		},
		empty(exerciseId: string): PersonalRecord {
			return createEmptyRecord(exerciseId);
		}
	};
}

export const records = createRecordsStore();
export const recordsReady = { subscribe: records.ready.subscribe };
export const recordsSync = { subscribe: records.sync.subscribe };
