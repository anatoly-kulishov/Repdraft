import type { PersonalRecord, WorkoutPlan, WorkoutSession } from './types';

export const EXPORT_VERSION = 1 as const;

export type RepdraftExportPayload = {
	version: typeof EXPORT_VERSION;
	exportedAt: string;
	plans: WorkoutPlan[];
	sessions: WorkoutSession[];
	records: PersonalRecord[];
};

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

function csvEscape(value: string | number | null | undefined): string {
	if (value == null) return '';
	const s = String(value);
	if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
	return s;
}

/** Flat session log CSV (one row per set) for spreadsheet tools. */
export function sessionsToCsv(sessions: WorkoutSession[]): string {
	const header = [
		'sessionId',
		'finishedAt',
		'planName',
		'exerciseId',
		'setIndex',
		'weightKg',
		'reps',
		'completed',
		'kind'
	];
	const rows = [header.join(',')];
	for (const session of sessions) {
		for (const ex of session.exercises) {
			ex.sets.forEach((set, setIndex) => {
				rows.push(
					[
						csvEscape(session.id),
						csvEscape(session.finishedAt),
						csvEscape(session.planName),
						csvEscape(ex.exerciseId),
						csvEscape(setIndex + 1),
						csvEscape(set.weightKg),
						csvEscape(set.reps),
						csvEscape(set.completed ? 1 : 0),
						csvEscape(set.kind ?? 'work')
					].join(',')
				);
			});
		}
	}
	return `${rows.join('\n')}\n`;
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
	const csv = sessionsToCsv(sessions);
	if (!csv.startsWith('sessionId,') || !csv.includes('40') || !csv.includes('ex-a')) {
		throw new Error(`sessionsToCsv unexpected ${csv}`);
	}
	if (csvEscape('a,b') !== '"a,b"' || csvEscape('say "hi"') !== '"say ""hi"""') {
		throw new Error('csvEscape failed');
	}
	if (exportStamp('2026-08-15T12:34:56.789Z') !== '2026-08-15T12-34-56') {
		throw new Error('exportStamp failed');
	}
}
