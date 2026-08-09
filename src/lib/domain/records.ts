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

/** Throws if PR sanitize / merge invariants regress. */
export function runRecordsSelfCheck(): void {
	const empty = createEmptyRecord('ex-1');
	if (!isRecordEmpty(empty)) throw new Error('empty record should be empty');

	const needValue = sanitizePersonalRecord(empty);
	if (needValue.ok || needValue.errorKey !== 'pr.needValue') {
		throw new Error('empty sanitize should needValue');
	}

	const badWeight = sanitizePersonalRecord({
		...empty,
		weightKg: 9999,
		reps: 5
	});
	if (badWeight.ok || badWeight.errorKey !== 'pr.invalidWeight') {
		throw new Error('out-of-range weight should fail');
	}

	const ok = sanitizePersonalRecord({
		exerciseId: 'ex-1',
		weightKg: 100.46,
		reps: 5,
		note: '  pause  ',
		updatedAt: '2026-08-01T00:00:00.000Z'
	});
	if (!ok.ok) throw new Error(`sanitize should pass: ${ok.errorKey}`);
	if (ok.record.weightKg !== 100.5) {
		throw new Error(`weight should round to 0.1, got ${ok.record.weightKg}`);
	}
	if (ok.record.note !== 'pause') throw new Error('note should be trimmed');

	const older: PersonalRecord = {
		exerciseId: 'ex-1',
		weightKg: 90,
		reps: 5,
		note: '',
		updatedAt: '2026-07-01T00:00:00.000Z'
	};
	const newer: PersonalRecord = {
		exerciseId: 'ex-1',
		weightKg: 100,
		reps: 5,
		note: '',
		updatedAt: '2026-08-01T00:00:00.000Z'
	};
	const localOnly: PersonalRecord = {
		exerciseId: 'ex-2',
		weightKg: 40,
		reps: 8,
		note: '',
		updatedAt: '2026-08-02T00:00:00.000Z'
	};
	const merged = mergePersonalRecords([older, localOnly], [newer]);
	if (merged.length !== 2) throw new Error(`merge length ${merged.length}`);
	const ex1 = merged.find((r) => r.exerciseId === 'ex-1');
	if (!ex1 || ex1.weightKg !== 100) throw new Error('cloud newer should win for ex-1');
	if (!merged.some((r) => r.exerciseId === 'ex-2')) {
		throw new Error('local-only PR must survive empty cloud overlap');
	}
}
