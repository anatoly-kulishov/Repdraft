import { browser } from '$app/environment';
import {
	createEmptyRecord,
	mergePersonalRecords,
	sanitizePersonalRecord
} from '$lib/domain/records';
import type { PersonalRecord } from '$lib/domain/types';
import { localRecordRepository } from '$lib/storage/localRecordRepository';
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
	const store = writable<PersonalRecord[]>([]);
	const ready = writable(false);
	const sync = writable<CloudSyncState>('idle');
	let inflight: Promise<void> | null = null;

	function invalidate() {
		inflight = null;
		store.set([]);
		sync.set('idle');
		ready.set(false);
		clearLastSyncedAt('records');
	}

	async function refresh(opts?: { cloud?: boolean; force?: boolean }) {
		if (!browser) {
			store.set([]);
			sync.set('synced');
			ready.set(true);
			return;
		}
		if (inflight) return inflight;

		const wantCloud = opts?.cloud !== false;
		const forceCloud = opts?.force === true;

		inflight = (async () => {
			try {
				await refreshLocalCloudList({
					localList: () => localRecordRepository.list(),
					cloudList: () => supabaseRecordRepository.list(),
					merge: mergePersonalRecords,
					wantCloud,
					forceCloud,
					listKey: 'records',
					previousItems: get(store),
					label: 'records',
					onUpdate: (result) => {
						store.set(result.items);
						sync.set(result.state);
						if (result.state !== 'loading') ready.set(true);
					}
				});
			} catch (err) {
				console.error('records.refresh failed', err);
				if (get(store).length === 0) store.set([]);
				sync.set('error');
				ready.set(true);
			} finally {
				inflight = null;
			}
		})();

		return inflight;
	}

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
