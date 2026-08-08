import { browser } from '$app/environment';
import { createEmptyRecord, isRecordEmpty } from '$lib/domain/records';
import type { PersonalRecord } from '$lib/domain/types';
import { withTimeout } from '$lib/domain/withTimeout';
import { getRecordRepo, isCloudMode } from '$lib/storage/dataAccess';
import { localRecordRepository } from '$lib/storage/localRecordRepository';
import { supabaseRecordRepository } from '$lib/storage/supabaseRecordRepository';
import { get, writable } from 'svelte/store';

const CLOUD_MS = 4000;

function createRecordsStore() {
	const store = writable<PersonalRecord[]>([]);
	const ready = writable(false);
	let inflight: Promise<void> | null = null;

	async function refresh() {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		if (inflight) return inflight;

		inflight = (async () => {
			try {
				const local = await localRecordRepository.list();
				if (local.length > 0) store.set(local);
				ready.set(true);

				if (isCloudMode()) {
					try {
						const cloud = await withTimeout(supabaseRecordRepository.list(), CLOUD_MS);
						store.set(cloud);
					} catch (err) {
						console.warn('records cloud refresh failed', err);
						if (local.length === 0) store.set([]);
					}
				} else {
					store.set(local);
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
			if (isRecordEmpty(record)) return false;
			const next = { ...record, updatedAt: new Date().toISOString() };
			await getRecordRepo().save(next);
			await localRecordRepository.save(next);
			await refresh();
			return true;
		},
		async remove(exerciseId: string) {
			await getRecordRepo().remove(exerciseId);
			await localRecordRepository.remove(exerciseId);
			await refresh();
		},
		empty(exerciseId: string): PersonalRecord {
			return createEmptyRecord(exerciseId);
		}
	};
}

export const records = createRecordsStore();
export const recordsReady = { subscribe: records.ready.subscribe };
