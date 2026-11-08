/**
 * Recognized workout program (photo / Excel) → catalog match.
 * Pure: no fetch. Model returns raw names; matching is deterministic.
 */
import {
	matchCatalogExercise,
	normalizeExerciseName,
	suggestCatalogCandidates
} from './importCsv';
import { clampPlanName, REPS, REST_SEC, SETS } from './inputLimits';
import type { ExerciseIndexItem, WorkoutExercise } from './types';
import { DEFAULT_REPS, DEFAULT_REST_SEC, DEFAULT_SETS } from './workoutDefaults';

export type RecognizedRow = {
	name: string;
	sets: number;
	reps: number;
	restSec?: number;
};

export type RecognizedProgram = {
	name: string;
	rows: RecognizedRow[];
};

export type MatchedUnmatched = {
	key: string;
	name: string;
	candidates: ExerciseIndexItem[];
};

export type MatchedProgram = {
	name: string;
	exercises: WorkoutExercise[];
	unmatched: MatchedUnmatched[];
};

function clampInt(n: number, min: number, max: number, fallback: number): number {
	const rounded = Math.round(n);
	if (!Number.isFinite(rounded)) return fallback;
	return Math.min(max, Math.max(min, rounded));
}

function buildCatalogKeys(catalog: readonly ExerciseIndexItem[]): Map<string, ExerciseIndexItem> {
	const keys = new Map<string, ExerciseIndexItem>();
	for (const item of catalog) {
		keys.set(normalizeExerciseName(item.name), item);
		if (item.name_ru) keys.set(normalizeExerciseName(item.name_ru), item);
	}
	return keys;
}

/**
 * Map recognized rows onto catalog exercises.
 * `overrides`: normalized source name → catalog id, or `''` to skip the row.
 */
export function matchRecognizedProgram(
	program: RecognizedProgram,
	catalog: readonly ExerciseIndexItem[],
	overrides?: Readonly<Record<string, string>>
): MatchedProgram {
	const keys = buildCatalogKeys(catalog);
	const exercises: WorkoutExercise[] = [];
	const unmatched: MatchedUnmatched[] = [];
	const seenIds = new Set<string>();
	const seenUnmatched = new Set<string>();

	const name = clampPlanName(program.name?.trim() || 'Program');

	for (const row of program.rows) {
		const rawName = (row.name ?? '').trim();
		if (!rawName) continue;
		const key = normalizeExerciseName(rawName);
		if (!key) continue;

		const sets = clampInt(row.sets, SETS.min, SETS.max, DEFAULT_SETS);
		const reps = clampInt(row.reps, REPS.min, REPS.max, DEFAULT_REPS);
		const restSec = clampInt(
			row.restSec ?? DEFAULT_REST_SEC,
			REST_SEC.min,
			REST_SEC.max,
			DEFAULT_REST_SEC
		);

		const override = overrides?.[key];
		if (override === '') continue;

		let exerciseId: string | null = null;
		if (typeof override === 'string' && override.trim()) {
			exerciseId = override.trim();
		} else {
			const hit = matchCatalogExercise(rawName, keys, catalog);
			exerciseId = hit?.id ?? null;
		}

		if (!exerciseId) {
			if (!seenUnmatched.has(key)) {
				seenUnmatched.add(key);
				unmatched.push({
					key,
					name: rawName,
					candidates: suggestCatalogCandidates(rawName, catalog, 5)
				});
			}
			continue;
		}

		if (seenIds.has(exerciseId)) continue;
		seenIds.add(exerciseId);
		exercises.push({ exerciseId, sets, reps, restSec });
	}

	return { name, exercises, unmatched };
}

export function runRecognizeProgramSelfCheck(): void {
	const catalog: ExerciseIndexItem[] = [
		{
			id: '0025',
			name: 'barbell bench press',
			name_ru: 'Жим лёжа',
			body_part: 'chest',
			equipment: 'barbell',
			target: 'pectorals',
			muscle_group: 'chest',
			secondary_muscles: [],
			image: 'images/x.jpg'
		},
		{
			id: '0043',
			name: 'cable seated row',
			body_part: 'back',
			equipment: 'cable',
			target: 'lats',
			muscle_group: 'back',
			secondary_muscles: [],
			image: 'images/y.jpg'
		}
	];

	const program: RecognizedProgram = {
		name: 'Push day',
		rows: [
			{ name: 'Bench Press (Barbell)', sets: 4, reps: 6, restSec: 150 },
			{ name: 'Weird Machine 9000', sets: 3, reps: 12 },
			{ name: 'Жим лёжа', sets: 3, reps: 8 }
		]
	};

	const matched = matchRecognizedProgram(program, catalog);
	if (matched.name !== 'Push day') throw new Error('recognizeProgram: name');
	if (matched.exercises.length !== 1 || matched.exercises[0]?.exerciseId !== '0025') {
		throw new Error('recognizeProgram: expected one matched bench press');
	}
	if (matched.unmatched.length !== 1 || matched.unmatched[0]?.key !== 'weird machine 9000') {
		throw new Error('recognizeProgram: expected unmatched weird machine');
	}

	const withOverride = matchRecognizedProgram(program, catalog, {
		'weird machine 9000': '0043'
	});
	if (withOverride.exercises.length !== 2) {
		throw new Error('recognizeProgram: override should add second exercise');
	}
	if (withOverride.unmatched.length !== 0) {
		throw new Error('recognizeProgram: override clears unmatched');
	}

	const skipped = matchRecognizedProgram(program, catalog, { 'weird machine 9000': '' });
	if (skipped.unmatched.length !== 0 || skipped.exercises.length !== 1) {
		throw new Error('recognizeProgram: empty override skips row');
	}
}
