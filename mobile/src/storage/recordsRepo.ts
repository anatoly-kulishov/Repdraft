import { RECORDS_STORAGE_KEY, type RecordRepository } from '@repdraft/domain/repository';
import type { PersonalRecord } from '@repdraft/domain/types';
import { kvGetJson, kvSetJson } from './kv';

async function readAll(): Promise<PersonalRecord[]> {
	const list = await kvGetJson<PersonalRecord[]>(RECORDS_STORAGE_KEY, []);
	return Array.isArray(list) ? list : [];
}

export const recordsRepo: RecordRepository = {
	async list() {
		return readAll();
	},
	async get(exerciseId) {
		return (await readAll()).find((r) => r.exerciseId === exerciseId) ?? null;
	},
	async save(record) {
		const list = await readAll();
		const idx = list.findIndex((r) => r.exerciseId === record.exerciseId);
		if (idx >= 0) list[idx] = record;
		else list.push(record);
		await kvSetJson(RECORDS_STORAGE_KEY, list);
	},
	async remove(exerciseId) {
		await kvSetJson(
			RECORDS_STORAGE_KEY,
			(await readAll()).filter((r) => r.exerciseId !== exerciseId)
		);
	}
};
