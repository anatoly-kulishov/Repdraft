/**
 * CSV import — Phase 1 wedge (Strong is effectively sunset; users migrate with history).
 * Pure domain: file text + catalog in, `RepdraftExportPayload` out, so the existing
 * merge/apply path (`applyLocalBackupImport`) is reused unchanged.
 */
import type { ExerciseIndexItem, LoggedSet, WorkoutSession } from './types';
import { EXPORT_VERSION, type RepdraftExportPayload } from './exportData';
import type { CustomExercise } from './customExercises';
import { CUSTOM_EXERCISE_NAME_MAX } from './customExercises';

export type CsvImportFormat = 'strong' | 'hevy' | 'fitnotes' | 'generic';

export type CsvImportReport = {
	format: CsvImportFormat;
	/** Non-empty data rows seen in the file. */
	rows: number;
	sessions: number;
	sets: number;
	/** Distinct exercise names mapped to the catalog. */
	matchedExercises: number;
	/** Distinct exercise names kept as custom exercises (data is never dropped). */
	customExercises: string[];
	/** Rows without a date/exercise or without weight and reps (cardio, notes). */
	skippedRows: number;
	/** Strong exports carry no unit column; values are read as the user's app unit. */
	weightUnitAssumed: 'kg';
	dateRange: { from: string; to: string } | null;
};

export type CsvImportResult =
	| { ok: true; payload: RepdraftExportPayload; report: CsvImportReport }
	| { ok: false; reason: 'notCsv' | 'unsupportedFormat' | 'noData' };

const DEFAULT_REST_SEC = 90;
const DEFAULT_DURATION_MS = 45 * 60 * 1000;

/** RFC 4180 splitter: quoted fields, embedded commas/newlines, escaped quotes. */
export function splitCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (inQuotes) {
			if (ch === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
			continue;
		}
		if (ch === ',') {
			row.push(field);
			field = '';
			continue;
		}
		if (ch === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}
		field += ch;
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normalizeHeader(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function headerIndex(headers: string[], ...names: string[]): number {
	for (const name of names) {
		const idx = headers.indexOf(name);
		if (idx >= 0) return idx;
	}
	return -1;
}

/** Header sets we can read (order-independent, extra columns tolerated). */
export function detectCsvFormat(row: readonly string[] | undefined): CsvImportFormat | null {
	if (!row) return null;
	const headers = row.map(normalizeHeader);
	const has = (...names: string[]) => headerIndex(headers, ...names) >= 0;

	if (has('date') && has('exercise name') && has('weight') && has('reps')) return 'strong';

	/* Hevy: workout title + start_time + exercise_title (+ weight_kg / reps). */
	if (has('exercise_title') && has('start_time')) return 'hevy';

	/* FitNotes: exercise + category + weight in kg or lbs + reps. */
	if (has('exercise') && has('reps') && (has('weight (kg)') || has('weight (lbs)'))) return 'fitnotes';

	/* Generic spreadsheet: needs at least a date-ish, exercise-ish and reps-ish column. */
	const generic =
		has('date', 'дата', 'дата тренировки') &&
		has('exercise', 'exercise name', 'упражнение') &&
		has('reps', 'repetitions', 'повторы', 'повторения');
	if (generic) return 'generic';

	return null;
}

type ColumnMap = {
	date: number;
	workout: number;
	exercise: number;
	order: number;
	weight: number;
	weightLb: number;
	reps: number;
	duration: number;
	end: number;
};

function columnsFor(format: CsvImportFormat, headers: string[]): ColumnMap | null {
	const pick = (...names: string[]) => headerIndex(headers, ...names);
	const empty: ColumnMap = {
		date: -1,
		workout: -1,
		exercise: -1,
		order: -1,
		weight: -1,
		weightLb: -1,
		reps: -1,
		duration: -1,
		end: -1
	};

	if (format === 'strong') {
		const map: ColumnMap = {
			...empty,
			date: pick('date'),
			workout: pick('workout name'),
			exercise: pick('exercise name'),
			order: pick('set order'),
			weight: pick('weight'),
			reps: pick('reps'),
			duration: pick('duration')
		};
		return map.date >= 0 && map.exercise >= 0 ? map : null;
	}

	if (format === 'hevy') {
		const map: ColumnMap = {
			...empty,
			date: pick('start_time'),
			workout: pick('title'),
			exercise: pick('exercise_title'),
			order: pick('set_index'),
			weight: pick('weight_kg', 'weight'),
			reps: pick('reps'),
			duration: pick('duration_seconds'),
			end: pick('end_time')
		};
		return map.date >= 0 && map.exercise >= 0 ? map : null;
	}

	if (format === 'fitnotes') {
		const map: ColumnMap = {
			...empty,
			date: pick('date'),
			exercise: pick('exercise'),
			order: pick('set'),
			weight: pick('weight (kg)'),
			weightLb: pick('weight (lbs)'),
			reps: pick('reps'),
			duration: pick('duration')
		};
		return map.date >= 0 && map.exercise >= 0 ? map : null;
	}

	const map: ColumnMap = {
		...empty,
		date: pick('date', 'дата', 'дата тренировки'),
		workout: pick('workout', 'workout name', 'тренировка', 'день'),
		exercise: pick('exercise', 'exercise name', 'упражнение'),
		order: pick('set', 'set order', 'подход'),
		weight: pick('weight', 'weight (kg)', 'вес', 'вес (кг)'),
		weightLb: pick('weight (lbs)', 'вес (фунты)'),
		reps: pick('reps', 'repetitions', 'повторы', 'повторения'),
		duration: pick('duration', 'время', 'длительность')
	};
	return map.date >= 0 && map.exercise >= 0 ? map : null;
}

const LB_TO_KG = 0.45359237;

/** Source unit only matters when the format itself carries no unit column. */
function scaleWeight(
	weight: number | null,
	format: CsvImportFormat,
	scale: 'kg' | 'lb' | undefined
): number | null {
	if (weight == null || scale !== 'lb') return weight;
	if (format === 'hevy' || format === 'fitnotes') return weight;
	return Math.round(weight * LB_TO_KG * 10) / 10;
}

function weightFor(format: CsvImportFormat, row: readonly string[], columns: ColumnMap): number | null {
	const kg = columns.weight >= 0 ? parseNumber(row[columns.weight]) : null;
	if (kg != null) return kg;
	if (format === 'fitnotes' || format === 'generic') {
		const lb = columns.weightLb >= 0 ? parseNumber(row[columns.weightLb]) : null;
		if (lb != null) return Math.round(lb * LB_TO_KG * 10) / 10;
	}
	return null;
}

/** Stable FNV-1a → base36, used for idempotent session/exercise ids across re-imports. */
export function stableId(prefix: string, seed: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `${prefix}${hash.toString(36)}`;
}

/** «Bench Press (Barbell)» → «bench press barbell». Keys are matched in this form. */
export function normalizeExerciseName(name: string): string {
	return name
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[()[\]{}.,/\\'"`´–—-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const NAME_STOPWORDS = new Set(['v', '2', '3', 'version', 'the', 'a']);

/**
 * Variant words that change the movement. A catalog name carrying one of these
 * must not silently absorb a source name that lacks it
 * («Shoulder Press (Dumbbell)» ≠ «Dumbbell One Arm Shoulder Press»).
 */
const NAME_VARIANT_WORDS = new Set([
	'one',
	'two',
	'single',
	'arm',
	'alternate',
	'alternating',
	'close',
	'grip',
	'wide',
	'narrow',
	'incline',
	'decline',
	'seated',
	'standing',
	'kneeling',
	'supine',
	'prone',
	'guillotine',
	'underhand',
	'overhand',
	'reverse',
	'hammer',
	'neutral',
	'assisted',
	'front',
	'behind',
	'smith',
	'v.2'
]);

export function exerciseNameTokens(name: string): string[] {
	return normalizeExerciseName(name)
		.split(' ')
		.filter((t) => t.length > 0 && !NAME_STOPWORDS.has(t));
}

/**
 * Catalog naming is «Barbell Bench Press», imports are «Bench Press (Barbell)».
 * Exact string match is useless, so: prefer the shortest catalog name that covers
 * every source token; otherwise require a high Jaccard overlap.
 */
export function matchCatalogExercise(
	name: string,
	keys: Map<string, ExerciseIndexItem>,
	items: readonly ExerciseIndexItem[]
): ExerciseIndexItem | null {
	const exact = keys.get(normalizeExerciseName(name));
	if (exact) return exact;

	const source = exerciseNameTokens(name);
	if (source.length === 0) return null;
	const sourceSet = new Set(source);

	let bestCover: ExerciseIndexItem | null = null;
	let bestCoverSize = Number.POSITIVE_INFINITY;
	let bestOverlap: { item: ExerciseIndexItem; score: number } | null = null;

	for (const item of items) {
		const tokens = exerciseNameTokens(item.name);
		if (tokens.length === 0) continue;
		const covers = source.every((t) => tokens.includes(t));
		if (covers) {
			const addsVariant = tokens.some((t) => NAME_VARIANT_WORDS.has(t) && !sourceSet.has(t));
			if (addsVariant) continue;
			if (tokens.length < bestCoverSize) {
				bestCover = item;
				bestCoverSize = tokens.length;
			}
			continue;
		}
		let shared = 0;
		for (const t of tokens) if (sourceSet.has(t)) shared++;
		const score = shared / (tokens.length + source.length - shared);
		if (score >= 0.75 && (!bestOverlap || score > bestOverlap.score)) {
			bestOverlap = { item, score };
		}
	}

	return bestCover ?? bestOverlap?.item ?? null;
}

function parseNumber(raw: string | undefined): number | null {
	if (raw == null) return null;
	const cleaned = raw.trim().replace(',', '.').replace(/[^\d.-]/g, '');
	if (!cleaned) return null;
	const value = Number(cleaned);
	return Number.isFinite(value) ? value : null;
}

function parseDurationMs(raw: string | undefined): number | null {
	if (!raw) return null;
	const text = raw.trim().toLowerCase();
	if (!text) return null;
	const hours = /(\d+)\s*h/.exec(text);
	const minutes = /(\d+)\s*m/.exec(text);
	const seconds = /(\d+)\s*s/.exec(text);
	if (hours || minutes || seconds) {
		return (
			Number(hours?.[1] ?? 0) * 3_600_000 +
			Number(minutes?.[1] ?? 0) * 60_000 +
			Number(seconds?.[1] ?? 0) * 1000
		);
	}
	const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
	if (clock) {
		return (
			Number(clock[1]) * 3_600_000 + Number(clock[2]) * 60_000 + Number(clock[3] ?? 0) * 1000
		);
	}
	return null;
}

/** Strong dates are «YYYY-MM-DD HH:mm:ss» (local). Fall back to native parsing. */
function parseDate(raw: string | undefined): Date | null {
	const text = (raw ?? '').trim();
	if (!text) return null;
	const direct = new Date(text.replace(' ', 'T'));
	if (!Number.isNaN(direct.getTime())) return direct;
	const fallback = new Date(text);
	return Number.isNaN(fallback.getTime()) ? null : fallback;
}

type PendingSet = { order: number; set: LoggedSet };

type PendingExercise = {
	name: string;
	sets: PendingSet[];
};

type PendingSession = {
	key: string;
	planName: string;
	startedAt: Date;
	durationMs: number | null;
	exercises: Map<string, PendingExercise>;
};

export type ParseCsvOptions = {
	catalog: readonly ExerciseIndexItem[];
	/** Injectable clock for deterministic self-checks. */
	now?: () => Date;
	/** Manual mapping: normalized source name → catalog id, or '' to keep it custom. */
	overrides?: Readonly<Record<string, string>>;
	/** Unit of the source weights when the file does not say (Strong/generic files). */
	weightScale?: 'kg' | 'lb';
};

/** @deprecated use {@link ParseCsvOptions} */
export type ParseStrongCsvOptions = ParseCsvOptions;

function durationFor(
	format: CsvImportFormat,
	row: readonly string[],
	columns: ColumnMap,
	start: Date
): number | null {
	if (format === 'hevy') {
		const end = columns.end >= 0 ? parseDate(row[columns.end]) : null;
		if (end) {
			const ms = end.getTime() - start.getTime();
			if (ms > 0) return ms;
		}
		const seconds = columns.duration >= 0 ? parseNumber(row[columns.duration]) : null;
		if (seconds != null && seconds > 0) return seconds * 1000;
		return null;
	}
	return columns.duration >= 0 ? parseDurationMs(row[columns.duration]) : null;
}

export function parseCsvImport(text: string, opts: ParseCsvOptions): CsvImportResult {
	const rows = splitCsvRows(text);
	const header = rows[0];
	const format = detectCsvFormat(header);
	if (!format) {
		return rows.length === 0 ? { ok: false, reason: 'notCsv' } : { ok: false, reason: 'unsupportedFormat' };
	}

	const headers = header!.map(normalizeHeader);
	const col = columnsFor(format, headers);
	if (!col) return { ok: false, reason: 'unsupportedFormat' };

	const byKey = new Map<string, PendingSession>();
	let dataRows = 0;
	let skippedRows = 0;

	for (const row of rows.slice(1)) {
		dataRows++;
		const date = parseDate(row[col.date]);
		const exerciseName = (row[col.exercise] ?? '').trim();
		if (!date || !exerciseName) {
			skippedRows++;
			continue;
		}
		const reps = parseNumber(row[col.reps]);
		const weight = scaleWeight(weightFor(format, row, col), format, opts.weightScale);
		if (reps == null && weight == null) {
			skippedRows++;
			continue;
		}

		const planName = (row[col.workout] ?? '').trim() || 'Imported workout';
		const key = `${date.toISOString()}|${planName}`;
		let session = byKey.get(key);
		if (!session) {
			session = {
				key,
				planName,
				startedAt: date,
				durationMs: durationFor(format, row, col, date),
				exercises: new Map()
			};
			byKey.set(key, session);
		}
		const exerciseKey = normalizeExerciseName(exerciseName);
		let pending = session.exercises.get(exerciseKey);
		if (!pending) {
			pending = { name: exerciseName, sets: [] };
			session.exercises.set(exerciseKey, pending);
		}
		const order = parseNumber(row[col.order]) ?? pending.sets.length + 1;
		pending.sets.push({
			order,
			set: { weightKg: weight, reps, completed: true }
		});
	}

	if (byKey.size === 0) return { ok: false, reason: 'noData' };

	const catalogByKey = new Map<string, ExerciseIndexItem>();
	for (const item of opts.catalog) {
		catalogByKey.set(normalizeExerciseName(item.name), item);
		if (item.name_ru) catalogByKey.set(normalizeExerciseName(item.name_ru), item);
	}

	const createdAt = (opts.now?.() ?? new Date()).toISOString();
	const customExercises = new Map<string, CustomExercise>();
	const matchedNames = new Set<string>();
	const matchCache = new Map<string, ExerciseIndexItem | null>();
	let setCount = 0;

	function resolveExercise(exerciseKey: string, displayName: string): string {
		const override = opts.overrides?.[exerciseKey];
		if (override !== undefined) {
			if (override === '') {
				/* Explicitly kept as a new exercise by the user. */
				const id = stableId('custom-imp-', exerciseKey);
				if (!customExercises.has(id)) {
					customExercises.set(id, {
						id,
						name: displayName.slice(0, CUSTOM_EXERCISE_NAME_MAX),
						bodyPart: 'full body',
						equipment: 'other',
						createdAt
					});
				}
				return id;
			}
			matchedNames.add(exerciseKey);
			return override;
		}
		if (!matchCache.has(exerciseKey)) {
			matchCache.set(exerciseKey, matchCatalogExercise(displayName, catalogByKey, opts.catalog));
		}
		const match = matchCache.get(exerciseKey) ?? null;
		if (match) {
			matchedNames.add(exerciseKey);
			return match.id;
		}
		const id = stableId('custom-imp-', exerciseKey);
		if (!customExercises.has(id)) {
			customExercises.set(id, {
				id,
				name: displayName.slice(0, CUSTOM_EXERCISE_NAME_MAX),
				bodyPart: 'full body',
				equipment: 'other',
				createdAt
			});
		}
		return id;
	}

	const sessions: WorkoutSession[] = [];
	for (const pending of [...byKey.values()].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
		const startedAt = pending.startedAt;
		const finishedAt = new Date(
			startedAt.getTime() + (pending.durationMs ?? DEFAULT_DURATION_MS)
		);

		const exercises = [...pending.exercises.entries()].map(([exerciseKey, entry]) => {
			const exerciseId = resolveExercise(exerciseKey, entry.name);
			const sets = [...entry.sets]
				.sort((a, b) => a.order - b.order)
				.map((item) => item.set);
			setCount += sets.length;
			const repValues = sets.map((s) => s.reps ?? 0).filter((n) => n > 0);
			const targetReps = repValues.length
				? Math.round(repValues.reduce((a, b) => a + b, 0) / repValues.length)
				: 8;
			return {
				exerciseId,
				targetSets: sets.length,
				targetReps,
				restSec: DEFAULT_REST_SEC,
				sets
			};
		});

		sessions.push({
			id: stableId('import-strong-', pending.key),
			planId: null,
			planName: pending.planName,
			startedAt: startedAt.toISOString(),
			finishedAt: finishedAt.toISOString(),
			exercises
		});
	}

	const times = sessions
		.flatMap((s) => [s.startedAt, s.finishedAt])
		.filter((t): t is string => Boolean(t))
		.sort();
	const payload: RepdraftExportPayload = {
		version: EXPORT_VERSION,
		exportedAt: createdAt,
		plans: [],
		sessions,
		records: [],
		...(customExercises.size > 0 ? { customExercises: [...customExercises.values()] } : {})
	};

	return {
		ok: true,
		payload,
		report: {
			format,
			rows: dataRows,
			sessions: sessions.length,
			sets: setCount,
			matchedExercises: matchedNames.size,
			customExercises: [...customExercises.values()].map((c) => c.name),
			skippedRows,
			weightUnitAssumed: 'kg',
			dateRange: times.length ? { from: times[0], to: times[times.length - 1] } : null
		}
	};
}

/** Ranked catalog suggestions for a manual "did you mean" list. */
export function suggestCatalogCandidates(
	name: string,
	items: readonly ExerciseIndexItem[],
	limit = 5
): ExerciseIndexItem[] {
	const source = exerciseNameTokens(name);
	if (source.length === 0) return [];
	const sourceSet = new Set(source);
	const scored: { item: ExerciseIndexItem; score: number }[] = [];
	for (const item of items) {
		const tokens = exerciseNameTokens(item.name);
		if (tokens.length === 0) continue;
		let shared = 0;
		for (const t of tokens) if (sourceSet.has(t)) shared++;
		if (shared === 0) continue;
		scored.push({ item, score: shared / (tokens.length + source.length - shared) });
	}
	return scored
		.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)
		.slice(0, limit)
		.map((s) => s.item);
}

export function runImportCsvSelfCheck(): void {
	const csv = [
		'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
		'2024-01-15 18:30:00,Push,45m,Bench Press (Barbell),1,60,10,,,,,',
		'2024-01-15 18:30:00,Push,45m,Bench Press (Barbell),2,60,9,,,,,',
		'2024-01-15 18:30:00,Push,45m,My Weird Machine,1,25,12,,,,,',
		'2024-01-17 19:00:00,Pull,1h 5m,"Row, Seated",1,50,8,,,,,',
		'2024-01-17 19:00:00,Pull,1h 5m,Plank,1,,,"2km",,120,,'
	].join('\n');

	const catalog: ExerciseIndexItem[] = [
		{
			id: '0025',
			name: 'barbell bench press',
			name_ru: 'Жим лёжа',
			body_part: 'chest',
			equipment: 'barbell',
			target: 'pectorals',
			image: 'images/x.jpg'
		} as ExerciseIndexItem,
		{
			id: '0043',
			name: 'cable seated row',
			body_part: 'back',
			equipment: 'cable',
			target: 'lats',
			image: 'images/y.jpg'
		} as ExerciseIndexItem
	];

	const parsed = parseCsvImport(csv, { catalog, now: () => new Date('2026-01-01T00:00:00.000Z') });
	if (!parsed.ok) throw new Error('importCsv: Strong sample must parse');
	if (parsed.report.sessions !== 2) throw new Error('importCsv: expected 2 sessions');
	if (parsed.report.sets !== 4) throw new Error('importCsv: expected 4 logged sets');
	if (parsed.report.matchedExercises !== 2) {
		throw new Error('importCsv: verbatim order mismatch must still match catalog');
	}
	if (parsed.report.customExercises.length !== 1) throw new Error('importCsv: unmatched stays custom');
	if (parsed.report.skippedRows !== 1) throw new Error('importCsv: cardio row must be skipped');
	if (parsed.payload.sessions[0]?.exercises[0]?.exerciseId !== '0025') {
		throw new Error('importCsv: catalog name match failed');
	}
	if (matchCatalogExercise('Shoulder Press (Dumbbell)', new Map(), [
		{ id: '9', name: 'dumbbell one arm shoulder press', body_part: 'shoulders', equipment: 'dumbbell', target: 'delts', image: '' } as ExerciseIndexItem
	])) {
		throw new Error('importCsv: must not guess a different movement');
	}
	const again = parseCsvImport(csv, { catalog });
	if (!again.ok || again.payload.sessions[0]?.id !== parsed.payload.sessions[0]?.id) {
		throw new Error('importCsv: session ids must be stable across re-imports');
	}
	const hevyCsv = [
		'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
		'Push Day,2024-02-01 18:00:00,2024-02-01 19:00:00,,Bench Press (Barbell),,,0,normal,70,8,,,,',
		'Push Day,2024-02-01 18:00:00,2024-02-01 19:00:00,,Bench Press (Barbell),,,1,normal,70,7,,,,',
		'Push Day,2024-02-01 18:00:00,2024-02-01 19:00:00,,Cable Fly,,,0,normal,15,15,,,,'
	].join('\n');
	const hevy = parseCsvImport(hevyCsv, { catalog });
	if (!hevy.ok || hevy.report.format !== 'hevy') throw new Error('importCsv: Hevy format detect failed');
	if (hevy.report.sessions !== 1 || hevy.report.sets !== 3) {
		throw new Error('importCsv: Hevy sessions/sets failed');
	}
	const hevySession = hevy.payload.sessions[0]!;
	const hevyDuration =
		new Date(hevySession.finishedAt ?? 0).getTime() - new Date(hevySession.startedAt).getTime();
	if (hevyDuration !== 3_600_000) throw new Error('importCsv: Hevy duration from end_time failed');

	const fitnotes = parseCsvImport(
		[
			'Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Duration,Notes',
			'2024-03-01,Squat,Legs,100,,5,,,',
			'2024-03-01,Squat,Legs,,220,5,,,'
		].join('\n'),
		{ catalog }
	);
	if (!fitnotes.ok || fitnotes.report.format !== 'fitnotes') {
		throw new Error('importCsv: FitNotes format detect failed');
	}
	if (fitnotes.report.sets !== 2) throw new Error('importCsv: FitNotes sets failed');
	const lbSet = fitnotes.payload.sessions[0]?.exercises[0]?.sets[1];
	if (lbSet?.weightKg !== 99.8) throw new Error('importCsv: lbs → kg conversion failed');

	const generic = parseCsvImport(
		['Дата,Тренировка,Упражнение,Вес,Повторы', '2024-04-01,День ног,Присед,80,6'].join('\n'),
		{ catalog }
	);
	if (!generic.ok || generic.report.format !== 'generic') {
		throw new Error('importCsv: generic RU header detect failed');
	}
	if (generic.payload.sessions[0]?.exercises[0]?.sets[0]?.weightKg !== 80) {
		throw new Error('importCsv: generic weight failed');
	}

	const lbStrong = parseCsvImport(
		['Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps', '2024-05-01 10:00:00,Legs,40m,Bench Press (Barbell),1,225,5'].join('\n'),
		{ catalog, weightScale: 'lb' }
	);
	const lbWeight = lbStrong.ok
		? lbStrong.payload.sessions[0]?.exercises[0]?.sets[0]?.weightKg
		: null;
	if (lbWeight !== 102.1) throw new Error('importCsv: Strong lb → kg scale failed');

	const dirty = splitCsvRows('h1,h2\n"multi\nline","escaped ""q"""\n\n\n');
	if (dirty.length !== 2) throw new Error('importCsv: empty trailing rows must be dropped');
	if (dirty[1]?.[0] !== 'multi\nline') throw new Error('importCsv: quoted newline failed');
	if (dirty[1]?.[1] !== 'escaped "q"') throw new Error('importCsv: escaped quotes failed');

	if (parseCsvImport('a,b\n1,2', { catalog }).ok) throw new Error('importCsv: header detect failed');
	if (splitCsvRows('a,"b,c",d').at(0)?.length !== 3) throw new Error('importCsv: quoted comma failed');
	if (parseDurationMs('1h 5m') !== 3_900_000) throw new Error('importCsv: duration parse failed');
}
