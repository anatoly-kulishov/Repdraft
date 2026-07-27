import type { PersonalRecord } from './types';

export function formatPersonalRecord(record: PersonalRecord): string {
	const parts: string[] = [];
	if (record.weightKg != null && !Number.isNaN(record.weightKg)) {
		parts.push(`${trimNumber(record.weightKg)} кг`);
	}
	if (record.reps != null && !Number.isNaN(record.reps)) {
		parts.push(`${record.reps} повт.`);
	}
	if (parts.length === 0 && record.note.trim()) {
		return record.note.trim();
	}
	if (parts.length === 0) return '';
	const base = parts.join(' × ');
	const note = record.note.trim();
	return note ? `${base} · ${note}` : base;
}

function trimNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function createEmptyRecord(exerciseId: string): PersonalRecord {
	return {
		exerciseId,
		weightKg: null,
		reps: null,
		note: '',
		updatedAt: new Date().toISOString()
	};
}

export function isRecordEmpty(record: PersonalRecord): boolean {
	const hasWeight = record.weightKg != null && !Number.isNaN(record.weightKg);
	const hasReps = record.reps != null && !Number.isNaN(record.reps);
	const hasNote = record.note.trim().length > 0;
	return !hasWeight && !hasReps && !hasNote;
}
