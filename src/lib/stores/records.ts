import { browser } from '$app/environment';
import {
	createEmptyRecord,
	mergePersonalRecords,
	sanitizePersonalRecord
} from '$lib/domain/records';
import type { PersonalRecord } from '$lib/domain/types';
import { localRecordRepository } from '$lib/storage/localRecordRepository';
import { supabaseRecordRepository } from '$lib/storage/supabaseRecordRepository';
import { mirrorCloudWrite, refreshLocalCloudList } from '$lib/stores/cloudLocal';
import { isCloudMode } from '$lib/storage/dataAccess';
import { get, writable } from 'svelte/store';

function createRecordsStore() {
	const store = writable<PersonalRecord[]>([]);
	const ready = writable(false);
	let inflight: Promise<void> | null = null;

	async function refresh(opts?: { cloud?: boolean }) {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		if (inflight) return inflight;

		const wantCloud = opts?.cloud !== false;

		inflight = (async () => {
			try {
				const merged = await refreshLocalCloudList({
					localList: () => localRecordRepository.list(),
					cloudList: () => supabaseRecordRepository.list(),
					merge: mergePersonalRecords,
					wantCloud,
					label: 'records',
					onLocal: (local) => {
						store.set(local);
						ready.set(true);
					}
				});
				store.set(merged);
			} catch (err) {
				console.error('records.refresh failed', err);
				store.set([]);
			} finally {
				ready.set(true);
				inflight = null;
			}
		})();

		return inflight;
	}

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
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
				label: 'records.save'
			});
			await refresh({ cloud: cloudOk && isCloudMode() });
			return true;
		},
		async remove(exerciseId: string) {
			const cloudOk = await mirrorCloudWrite({
				localWrite: () => localRecordRepository.remove(exerciseId),
				cloudWrite: () => supabaseRecordRepository.remove(exerciseId),
				label: 'records.remove'
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
