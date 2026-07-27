import { RECORDS_STORAGE_KEY, type RecordRepository } from '$lib/domain/repository';
import type { PersonalRecord } from '$lib/domain/types';

function readAll(): PersonalRecord[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as PersonalRecord[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeAll(records: PersonalRecord[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
}

export const localRecordRepository: RecordRepository = {
	async list() {
		return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	},

	async get(exerciseId: string) {
		return readAll().find((r) => r.exerciseId === exerciseId) ?? null;
	},

	async save(record: PersonalRecord) {
		const records = readAll();
		const index = records.findIndex((r) => r.exerciseId === record.exerciseId);
		if (index >= 0) records[index] = record;
		else records.push(record);
		writeAll(records);
	},

	async remove(exerciseId: string) {
		writeAll(readAll().filter((r) => r.exerciseId !== exerciseId));
	}
};
