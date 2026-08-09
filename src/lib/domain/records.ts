import type { AppLocale } from '$lib/i18n/locale';
import { translate } from '$lib/i18n/messages';
import {
	NOTE_MAX,
	REPS,
	WEIGHT_KG,
	isValidReps,
	isValidWeightKg,
	sanitizeNote
} from './inputLimits';
import type { PersonalRecord } from './types';

export function formatPersonalRecord(record: PersonalRecord, locale: AppLocale = 'ru'): string {
	const parts: string[] = [];
	if (record.weightKg != null && !Number.isNaN(record.weightKg)) {
		parts.push(`${trimNumber(record.weightKg)} ${translate(locale, 'pr.kg')}`);
	}
	if (record.reps != null && !Number.isNaN(record.reps)) {
		parts.push(`${record.reps} ${translate(locale, 'pr.repsShort')}`);
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

export type RecordSanitizeResult =
	| { ok: true; record: PersonalRecord }
	| { ok: false; errorKey: string };

/** Normalize + validate before persist. */
export function sanitizePersonalRecord(input: PersonalRecord): RecordSanitizeResult {
	const note = sanitizeNote(input.note, NOTE_MAX);
	const weightKg = input.weightKg;
	const reps = input.reps;

	if (!isValidWeightKg(weightKg)) {
		return { ok: false, errorKey: 'pr.invalidWeight' };
	}
	if (!isValidReps(reps, REPS)) {
		return { ok: false, errorKey: 'pr.invalidReps' };
	}

	const record: PersonalRecord = {
		exerciseId: input.exerciseId,
		weightKg:
			weightKg == null
				? null
				: Math.min(WEIGHT_KG.max, Math.max(WEIGHT_KG.min, Math.round(weightKg * 10) / 10)),
		reps: reps == null ? null : Math.round(reps),
		note,
		updatedAt: input.updatedAt || new Date().toISOString()
	};

	if (isRecordEmpty(record)) {
		return { ok: false, errorKey: 'pr.needValue' };
	}

	return { ok: true, record };
}

/** Union local + cloud without dropping device-only PRs. */
export function mergePersonalRecords(
	local: PersonalRecord[],
	cloud: PersonalRecord[]
): PersonalRecord[] {
	const map = new Map<string, PersonalRecord>();
	for (const record of local) map.set(record.exerciseId, record);
	for (const record of cloud) {
		const prev = map.get(record.exerciseId);
		if (!prev || record.updatedAt.localeCompare(prev.updatedAt) >= 0) {
			map.set(record.exerciseId, record);
		}
	}
	return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
