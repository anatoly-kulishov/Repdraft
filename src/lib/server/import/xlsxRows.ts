/**
 * Spreadsheet → RecognizedProgram rows (server-only; exceljs).
 * Heuristic columns: exercise name / sets / reps / rest.
 */
import ExcelJS from 'exceljs';
import { splitCsvRows } from '$lib/domain/importCsv';
import type { RecognizedProgram, RecognizedRow } from '$lib/domain/recognizeProgram';
import { clampPlanName } from '$lib/domain/inputLimits';

function normalizeHeader(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/\s+/g, ' ');
}

type ColMap = {
	name: number;
	sets: number;
	reps: number;
	rest: number;
};

function detectColumns(header: string[]): ColMap | null {
	const headers = header.map(normalizeHeader);
	const find = (...names: string[]) => {
		for (const n of names) {
			const idx = headers.indexOf(n);
			if (idx >= 0) return idx;
		}
		return -1;
	};

	const name = find(
		'exercise',
		'exercise name',
		'упражнение',
		'название',
		'name',
		'movement'
	);
	const sets = find('sets', 'set', 'подходы', 'подход', 'сеты', 'сет');
	const reps = find('reps', 'rep', 'repetitions', 'повторы', 'повторения', 'повт');
	const rest = find('rest', 'rest sec', 'rest_sec', 'отдых', 'отдых сек', 'отдых с');

	if (name >= 0) {
		return { name, sets, reps, rest };
	}

	/* Fallback: first non-empty text-ish column as name; numeric neighbors as sets/reps. */
	for (let i = 0; i < headers.length; i++) {
		if (headers[i]) return { name: i, sets: -1, reps: -1, rest: -1 };
	}
	return null;
}

function cellText(value: unknown): string {
	if (value == null) return '';
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value).trim();
	}
	if (typeof value === 'object' && value !== null && 'text' in value) {
		return String((value as { text: unknown }).text ?? '').trim();
	}
	if (typeof value === 'object' && value !== null && 'result' in value) {
		return String((value as { result: unknown }).result ?? '').trim();
	}
	return String(value).trim();
}

function parsePositiveInt(raw: string, fallback: number): number {
	const m = raw.replace(',', '.').match(/-?\d+(\.\d+)?/);
	if (!m) return fallback;
	const n = Math.round(Number(m[0]));
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseRestSec(raw: string): number | undefined {
	const t = raw.trim().toLowerCase();
	if (!t) return undefined;
	const minMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(мин|min|m)\b/);
	if (minMatch) {
		const mins = Number(minMatch[1]!.replace(',', '.'));
		if (Number.isFinite(mins) && mins >= 0) return Math.round(mins * 60);
	}
	const secMatch = t.match(/(\d+)\s*(сек|sec|s)\b/);
	if (secMatch) {
		const s = Number(secMatch[1]);
		if (Number.isFinite(s) && s >= 0) return s;
	}
	const bare = Number(t.replace(',', '.'));
	if (Number.isFinite(bare) && bare >= 0) return Math.round(bare);
	return undefined;
}

function rowsToProgram(matrix: string[][], sheetName: string): RecognizedProgram | null {
	if (matrix.length === 0) return null;

	let start = 0;
	let cols = detectColumns(matrix[0] ?? []);
	if (cols && cols.name >= 0 && (cols.sets >= 0 || cols.reps >= 0 || normalizeHeader(matrix[0]?.[cols.name] ?? '').length > 0)) {
		const headerLooksLikeHeader =
			cols.sets >= 0 ||
			cols.reps >= 0 ||
			/exercise|упражн|name|назван/.test(normalizeHeader(matrix[0]?.[cols.name] ?? ''));
		if (headerLooksLikeHeader) start = 1;
	} else {
		cols = { name: 0, sets: 1, reps: 2, rest: 3 };
	}

	const rows: RecognizedRow[] = [];
	for (let i = start; i < matrix.length; i++) {
		const line = matrix[i] ?? [];
		const name = (line[cols!.name] ?? '').trim();
		if (!name) continue;
		if (/^(exercise|упражнение|название|name)$/i.test(name)) continue;

		const setsRaw = cols!.sets >= 0 ? (line[cols!.sets] ?? '') : '';
		const repsRaw = cols!.reps >= 0 ? (line[cols!.reps] ?? '') : '';
		const restRaw = cols!.rest >= 0 ? (line[cols!.rest] ?? '') : '';

		const sets = parsePositiveInt(setsRaw, 3);
		const reps = parsePositiveInt(repsRaw.includes('-') ? repsRaw.split('-').pop()! : repsRaw, 10);
		const restSec = parseRestSec(restRaw);

		rows.push({
			name,
			sets,
			reps,
			...(restSec != null ? { restSec } : {})
		});
	}

	if (rows.length === 0) return null;
	return {
		name: clampPlanName(sheetName || 'Program'),
		rows
	};
}

export async function recognizedProgramFromXlsx(
	bytes: Buffer,
	fallbackName = 'Program'
): Promise<RecognizedProgram | null> {
	const workbook = new ExcelJS.Workbook();
	// exceljs typings accept Buffer via ArrayBuffer-like load
	await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
	const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0) ?? workbook.worksheets[0];
	if (!sheet) return null;

	const matrix: string[][] = [];
	sheet.eachRow({ includeEmpty: false }, (row) => {
		const values = row.values;
		const arr = Array.isArray(values) ? values.slice(1) : [];
		matrix.push(arr.map((cell) => cellText(cell)));
	});

	return rowsToProgram(matrix, sheet.name?.trim() || fallbackName);
}

export function recognizedProgramFromCsv(
	text: string,
	fallbackName = 'Program'
): RecognizedProgram | null {
	const matrix = splitCsvRows(text);
	return rowsToProgram(matrix, fallbackName);
}
