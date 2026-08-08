import { browser } from '$app/environment';
import { createEmptyRecord, isRecordEmpty } from '$lib/domain/records';
import type { PersonalRecord } from '$lib/domain/types';
import { getRecordRepo } from '$lib/storage/dataAccess';
import { get, writable } from 'svelte/store';

function createRecordsStore() {
	const store = writable<PersonalRecord[]>([]);
	const ready = writable(false);

	async function refresh() {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		try {
			const list = await getRecordRepo().list();
			store.set(list);
		} catch (err) {
			console.error('records.refresh failed', err);
			store.set([]);
		} finally {
			ready.set(true);
		}
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
			await getRecordRepo().save({
				...record,
				updatedAt: new Date().toISOString()
			});
			await refresh();
			return true;
		},
		async remove(exerciseId: string) {
			await getRecordRepo().remove(exerciseId);
			await refresh();
		},
		empty(exerciseId: string): PersonalRecord {
			return createEmptyRecord(exerciseId);
		}
	};
}

export const records = createRecordsStore();
export const recordsReady = { subscribe: records.ready.subscribe };
