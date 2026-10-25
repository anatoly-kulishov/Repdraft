import {
	mergeLocalWithImport,
	parseExportJson,
	type RepdraftExportPayload
} from '@repdraft/domain/exportData';
import {
	detectCsvFormat,
	parseCsvImport,
	splitCsvRows,
	type CsvImportReport
} from '@repdraft/domain/importCsv';
import type { ExerciseIndexItem } from '@repdraft/domain/types';
import {
	CUSTOM_EXERCISES_STORAGE_KEY,
	PLANS_STORAGE_KEY,
	RECORDS_STORAGE_KEY,
	SESSIONS_STORAGE_KEY
} from '@repdraft/domain/repository';
import { refreshCustomsCache } from '../catalog/loadIndex';
import { customsRepo } from './customsRepo';
import { kvSetJson } from './kv';
import { plansRepo } from './plansRepo';
import { recordsRepo } from './recordsRepo';
import { sessionsRepo } from './sessionsRepo';

export async function applyBackupImport(payload: RepdraftExportPayload): Promise<{
	plans: number;
	sessions: number;
	records: number;
	customs: number;
}> {
	const [plans, sessions, records, customs] = await Promise.all([
		plansRepo.list(),
		sessionsRepo.list(),
		recordsRepo.list(),
		customsRepo.list()
	]);
	const merged = mergeLocalWithImport({ plans, sessions, records, customs }, payload);
	await Promise.all([
		kvSetJson(PLANS_STORAGE_KEY, merged.plans),
		kvSetJson(SESSIONS_STORAGE_KEY, merged.sessions),
		kvSetJson(RECORDS_STORAGE_KEY, merged.records),
		kvSetJson(CUSTOM_EXERCISES_STORAGE_KEY, merged.customs ?? [])
	]);
	await refreshCustomsCache();
	return {
		plans: merged.plans.length,
		sessions: merged.sessions.length,
		records: merged.records.length,
		customs: (merged.customs ?? []).length
	};
}

export function parseBackupText(raw: string) {
	return parseExportJson(raw);
}

export type ImportFileResult =
	| { ok: true; kind: 'json'; payload: RepdraftExportPayload }
	| { ok: true; kind: 'csv'; payload: RepdraftExportPayload; report: CsvImportReport }
	| { ok: false; reason: 'invalidJson' | 'invalidShape' | 'unsupportedVersion' | 'csvEmpty' };

/** Same file picker serves Repdraft JSON backups and third-party CSV exports. */
export function parseImportText(raw: string, catalog: readonly ExerciseIndexItem[]): ImportFileResult {
	const json = parseExportJson(raw);
	if (json.ok) return { ok: true, kind: 'json', payload: json.payload };

	if (detectCsvFormat(splitCsvRows(raw)[0])) {
		const csv = parseCsvImport(raw, { catalog });
		if (!csv.ok) return { ok: false, reason: 'csvEmpty' };
		return { ok: true, kind: 'csv', payload: csv.payload, report: csv.report };
	}

	return { ok: false, reason: json.reason };
}
