import { browser } from '$app/environment';
import {
	createEmptyRecord,
	mergePersonalRecords,
	sanitizePersonalRecord
} from '$lib/domain/records';
import type { PersonalRecord } from '$lib/domain/types';
import { withTimeout } from '$lib/domain/withTimeout';
import { isCloudMode } from '$lib/storage/dataAccess';
import { localRecordRepository } from '$lib/storage/localRecordRepository';
import { supabaseRecordRepository } from '$lib/storage/supabaseRecordRepository';
import { get, writable } from 'svelte/store';

const CLOUD_MS = 4000;

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
				const local = await localRecordRepository.list();
				store.set(local);
				ready.set(true);

				if (wantCloud && isCloudMode()) {
					try {
						const cloud = await withTimeout(supabaseRecordRepository.list(), CLOUD_MS);
						store.set(mergePersonalRecords(local, cloud));
					} catch (err) {
						console.warn('records cloud refresh failed', err);
					}
				}
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
			await localRecordRepository.save(next);
			let cloudOk = !isCloudMode();
			if (isCloudMode()) {
				try {
					await withTimeout(supabaseRecordRepository.save(next), CLOUD_MS);
					cloudOk = true;
				} catch (err) {
					console.warn('records.save cloud failed', err);
					cloudOk = false;
				}
			}
			await refresh({ cloud: cloudOk && isCloudMode() });
			return true;
		},
		async remove(exerciseId: string) {
			await localRecordRepository.remove(exerciseId);
			let cloudOk = !isCloudMode();
			if (isCloudMode()) {
				try {
					await withTimeout(supabaseRecordRepository.remove(exerciseId), CLOUD_MS);
					cloudOk = true;
				} catch (err) {
					console.warn('records.remove cloud failed', err);
					cloudOk = false;
				}
			}
			await refresh({ cloud: cloudOk && isCloudMode() });
		},
		empty(exerciseId: string): PersonalRecord {
			return createEmptyRecord(exerciseId);
		}
	};
}

export const records = createRecordsStore();
export const recordsReady = { subscribe: records.ready.subscribe };
