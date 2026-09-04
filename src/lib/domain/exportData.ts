import { mergePersonalRecords } from './records';
import { mergeWorkoutSessions } from './session';
import type { PersonalRecord, WorkoutPlan, WorkoutSession } from './types';
import { mergeWorkoutPlans } from './workout';

export const EXPORT_VERSION = 1 as const;

export type RepdraftExportPayload = {
	version: typeof EXPORT_VERSION;
	exportedAt: string;
	plans: WorkoutPlan[];
	sessions: WorkoutSession[];
	records: PersonalRecord[];
};

export type ParseExportResult =
	| { ok: true; payload: RepdraftExportPayload }
	| { ok: false; reason: 'invalidJson' | 'invalidShape' | 'unsupportedVersion' };

export function buildExportPayload(
	plans: WorkoutPlan[],
	sessions: WorkoutSession[],
	records: PersonalRecord[],
	exportedAt = new Date().toISOString()
): RepdraftExportPayload {
	return {
		version: EXPORT_VERSION,
		exportedAt,
		plans,
		sessions,
		records
	};
}

export function exportPayloadToJson(payload: RepdraftExportPayload): string {
	return `${JSON.stringify(payload, null, 2)}\n`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkoutExercise(value: unknown): boolean {
	if (!isPlainObject(value)) return false;
	return (
		typeof value.exerciseId === 'string' &&
		typeof value.sets === 'number' &&
		typeof value.reps === 'number' &&
		typeof value.restSec === 'number'
	);
}

function isWorkoutPlan(value: unknown): value is WorkoutPlan {
	if (!isPlainObject(value)) return false;
	if (typeof value.id !== 'string' || typeof value.name !== 'string') return false;
	if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false;
	return Array.isArray(value.exercises) && value.exercises.every(isWorkoutExercise);
}

function isLoggedSet(value: unknown): boolean {
	if (!isPlainObject(value)) return false;
	return typeof value.completed === 'boolean';
}

function isSessionExercise(value: unknown): boolean {
	if (!isPlainObject(value)) return false;
	if (typeof value.exerciseId !== 'string') return false;
	if (typeof value.targetSets !== 'number' || typeof value.targetReps !== 'number') return false;
	if (typeof value.restSec !== 'number') return false;
	if (value.note !== undefined && typeof value.note !== 'string') return false;
	return Array.isArray(value.sets) && value.sets.every(isLoggedSet);
}

function isWorkoutSession(value: unknown): value is WorkoutSession {
	if (!isPlainObject(value)) return false;
	if (typeof value.id !== 'string' || typeof value.planName !== 'string') return false;
	if (typeof value.startedAt !== 'string') return false;
	if (!(value.finishedAt === null || typeof value.finishedAt === 'string')) return false;
	if (!(value.planId === null || typeof value.planId === 'string')) return false;
	return Array.isArray(value.exercises) && value.exercises.every(isSessionExercise);
}

function isPersonalRecord(value: unknown): value is PersonalRecord {
	if (!isPlainObject(value)) return false;
	if (typeof value.exerciseId !== 'string' || typeof value.updatedAt !== 'string') return false;
	if (typeof value.note !== 'string') return false;
	if (!(value.weightKg === null || typeof value.weightKg === 'number')) return false;
	if (!(value.reps === null || typeof value.reps === 'number')) return false;
	return true;
}

/** Parse a Repdraft JSON backup written by `exportPayloadToJson`. */
export function parseExportJson(raw: string): ParseExportResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		return { ok: false, reason: 'invalidJson' };
	}
	if (!isPlainObject(parsed)) return { ok: false, reason: 'invalidShape' };
	if (typeof parsed.version !== 'number') return { ok: false, reason: 'invalidShape' };
	if (parsed.version !== EXPORT_VERSION) return { ok: false, reason: 'unsupportedVersion' };
	if (typeof parsed.exportedAt !== 'string') return { ok: false, reason: 'invalidShape' };
	if (!Array.isArray(parsed.plans) || !parsed.plans.every(isWorkoutPlan)) {
		return { ok: false, reason: 'invalidShape' };
	}
	if (!Array.isArray(parsed.sessions) || !parsed.sessions.every(isWorkoutSession)) {
		return { ok: false, reason: 'invalidShape' };
	}
	if (!Array.isArray(parsed.records) || !parsed.records.every(isPersonalRecord)) {
		return { ok: false, reason: 'invalidShape' };
	}
	return {
		ok: true,
		payload: {
			version: EXPORT_VERSION,
			exportedAt: parsed.exportedAt,
			plans: parsed.plans,
			sessions: parsed.sessions,
			records: parsed.records
		}
	};
}

export type LocalDataBundle = {
	plans: WorkoutPlan[];
	sessions: WorkoutSession[];
	records: PersonalRecord[];
};

/** Merge backup into current local data (backup wins on same id when timestamps are newer/equal). */
export function mergeLocalWithImport(
	current: LocalDataBundle,
	imported: RepdraftExportPayload
): LocalDataBundle {
	return {
		plans: mergeWorkoutPlans(current.plans, imported.plans),
		sessions: mergeWorkoutSessions(current.sessions, imported.sessions),
		records: mergePersonalRecords(current.records, imported.records)
	};
}

export function exportStamp(iso = new Date().toISOString()): string {
	return iso.slice(0, 19).replaceAll(':', '-');
}

export function runExportDataSelfCheck(): void {
	const plans: WorkoutPlan[] = [
		{
			id: 'p1',
			name: 'Push',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			exercises: [{ exerciseId: 'ex-a', sets: 1, reps: 8, restSec: 90 }]
		}
	];
	const sessions: WorkoutSession[] = [
		{
			id: 's1',
			planId: 'p1',
			planName: 'Push',
			startedAt: '2026-01-02T10:00:00.000Z',
			finishedAt: '2026-01-02T11:00:00.000Z',
			exercises: [
				{
					exerciseId: 'ex-a',
					targetSets: 1,
					targetReps: 8,
					restSec: 90,
					sets: [{ weightKg: 40, reps: 8, completed: true }]
				}
			]
		}
	];
	const records: PersonalRecord[] = [
		{
			exerciseId: 'ex-a',
			weightKg: 40,
			reps: 8,
			note: 'ok',
			updatedAt: '2026-01-02T11:00:00.000Z'
		}
	];

	const payload = buildExportPayload(plans, sessions, records, '2026-08-15T12:00:00.000Z');
	if (payload.version !== 1 || payload.plans.length !== 1) {
		throw new Error('buildExportPayload shape failed');
	}
	const json = exportPayloadToJson(payload);
	if (!json.includes('"version": 1') || !json.includes('ex-a')) {
		throw new Error('exportPayloadToJson missing fields');
	}
	const roundTrip = parseExportJson(json);
	if (!roundTrip.ok || roundTrip.payload.plans[0]?.id !== 'p1') {
		throw new Error('parseExportJson round-trip failed');
	}
	if (parseExportJson('{').ok) throw new Error('invalid JSON should fail');
	if (parseExportJson('{"version":99,"exportedAt":"x","plans":[],"sessions":[],"records":[]}').ok) {
		throw new Error('unsupported version should fail');
	}
	const merged = mergeLocalWithImport(
		{ plans: [], sessions: [], records: [] },
		payload
	);
	if (merged.plans.length !== 1 || merged.sessions.length !== 1 || merged.records.length !== 1) {
		throw new Error('mergeLocalWithImport empty→payload failed');
	}
	if (exportStamp('2026-08-15T12:34:56.789Z') !== '2026-08-15T12-34-56') {
		throw new Error('exportStamp failed');
	}
}
