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
	const chips = personalRecordChips(record, locale);
	return chips.join(' · ');
}

/** Separate chips for list UI: weight×reps and optional note. */
export function personalRecordChips(record: PersonalRecord, locale: AppLocale = 'ru'): string[] {
	const chips: string[] = [];
	const lift: string[] = [];
	if (record.weightKg != null && !Number.isNaN(record.weightKg)) {
		lift.push(`${trimNumber(record.weightKg)} ${translate(locale, 'pr.kg')}`);
	}
	if (record.reps != null && !Number.isNaN(record.reps)) {
		lift.push(`${record.reps} ${translate(locale, 'pr.repsShort')}`);
	}
	if (lift.length > 0) chips.push(lift.join(' × '));
	const note = record.note.trim();
	if (note) chips.push(note);
	return chips;
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

export function hasLiftData(record: PersonalRecord): boolean {
	const hasWeight = record.weightKg != null && !Number.isNaN(record.weightKg);
	const hasReps = record.reps != null && !Number.isNaN(record.reps);
	return hasWeight || hasReps;
}

export function isRecordEmpty(record: PersonalRecord): boolean {
	return !hasLiftData(record) && record.note.trim().length === 0;
}

/** Compare lift + note only — ignores updatedAt. */
export function personalRecordContentEqual(a: PersonalRecord, b: PersonalRecord): boolean {
	return (
		a.exerciseId === b.exerciseId &&
		a.weightKg === b.weightKg &&
		a.reps === b.reps &&
		a.note === b.note
	);
}

export type RecordSanitizeResult =
	| { ok: true; record: PersonalRecord }
	| { ok: false; errorKey: string };

export type SanitizePersonalRecordOptions = {
	/** Cardio MVP: note alone is a valid personal record (no new storage fields). */
	allowNoteOnly?: boolean;
};

/** Normalize + validate before persist. */
export function sanitizePersonalRecord(
	input: PersonalRecord,
	options?: SanitizePersonalRecordOptions
): RecordSanitizeResult {
	const allowNoteOnly = options?.allowNoteOnly === true;
	const note = sanitizeNote(input.note, NOTE_MAX);
	const weightKg = allowNoteOnly ? null : input.weightKg;
	const reps = allowNoteOnly ? null : input.reps;

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
		return { ok: false, errorKey: allowNoteOnly ? 'pr.needNote' : 'pr.needValue' };
	}
	if (!hasLiftData(record) && !allowNoteOnly) {
		return { ok: false, errorKey: 'pr.needLift' };
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

	const noteOnly = sanitizePersonalRecord({ ...empty, note: 'pause cue' });
	if (noteOnly.ok || noteOnly.errorKey !== 'pr.needLift') {
		throw new Error('note-only sanitize should needLift');
	}

	const cardioNote = sanitizePersonalRecord(
		{ ...empty, note: '20 min · 5 km' },
		{ allowNoteOnly: true }
	);
	if (!cardioNote.ok || cardioNote.record.note !== '20 min · 5 km') {
		throw new Error('cardio note-only sanitize should pass');
	}
	if (cardioNote.record.weightKg != null || cardioNote.record.reps != null) {
		throw new Error('cardio note-only must clear lift fields');
	}

	const cardioEmpty = sanitizePersonalRecord(empty, { allowNoteOnly: true });
	if (cardioEmpty.ok || cardioEmpty.errorKey !== 'pr.needNote') {
		throw new Error('cardio empty sanitize should needNote');
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
	if (!personalRecordContentEqual(newer, { ...newer, updatedAt: '2099-01-01T00:00:00.000Z' })) {
		throw new Error('personalRecordContentEqual should ignore updatedAt');
	}
}
