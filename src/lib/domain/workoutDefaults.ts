import { usesExtraKgField } from './homeKit';
import { LADDER_REPS, SETS } from './inputLimits';
import type { ExerciseMeasure } from './types';

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_SEC = 90;
/** Squat / bench / deadlift family — longer recovery between heavy sets. */
export const HEAVY_COMPOUND_REST_SEC = 180;
/** Band / jump rope / roller / bodyweight family when adding to a plan. */
export const LIGHT_EQUIPMENT_REST_SEC = 60;

/** Inclusive linear ladder (5→1 or 1→5). Caps length at SETS.max; ends at LADDER_REPS.max. */
export function buildLadderScheme(from: number, to: number): number[] {
	const a = Math.min(LADDER_REPS.max, Math.max(LADDER_REPS.min, Math.round(from)));
	const b = Math.min(LADDER_REPS.max, Math.max(LADDER_REPS.min, Math.round(to)));
	const step = a <= b ? 1 : -1;
	const out: number[] = [];
	for (let n = a; step > 0 ? n <= b : n >= b; n += step) {
		out.push(n);
		if (out.length >= SETS.max) break;
	}
	return out.length > 0 ? out : [a];
}

export function hasLadderScheme(ex: { repsScheme?: number[] | null }): boolean {
	return Array.isArray(ex.repsScheme) && ex.repsScheme.length >= 2;
}

/** Display label for a ladder scheme, e.g. 5→1. */
export function formatLadderLabel(scheme: number[]): string {
	if (scheme.length === 0) return '';
	const first = scheme[0]!;
	const last = scheme[scheme.length - 1]!;
	return `${first}→${last}`;
}

/** A timed set: a hold in seconds or steady cardio in minutes. */
export function isTimedMeasure(ex: { measure?: ExerciseMeasure | null }): boolean {
	return ex.measure === 'seconds' || ex.measure === 'minutes';
}

/** Catalog bits the default-unit heuristic reads (no fetch, works in both clients). */
export type MeasureHint = {
	name?: string | null;
	name_ru?: string | null;
	body_part?: string | null;
};

/** Planks and isometrics: holding is the point, so reps make no sense. */
const HOLD_NAME_RE = /планк|\bplank|изометр|isometric/i;

/**
 * Steady cardio machines and locomotion — one continuous effort you measure in
 * minutes. Plyometric cardio (burpees, jumps, mountain climbers) stays reps.
 */
const STEADY_CARDIO_NAME_RE =
	/бегов[а-яё]*\s*дорожк|treadmill|велотренаж[а-яё]*|велосипед|езда\s+на\s+вело|\bbik(e|ing)\b|кросс-тренаж|cross[\s-]?trainer|эллипс|elliptical|степмилл|степпер|stair|гребн|row(er|ing)|скакалк|jump\s*rope|бег\s+на\s+месте|jog\s*in\s*place|ходьба|walking/i;

/**
 * What a catalog exercise is measured in before the athlete says otherwise.
 * Nobody should have to discover «Считать по времени» to log a plank: planks
 * come in seconds, the treadmill in minutes, everything else in reps.
 * The explicit `measure` always wins — this only fills the gap.
 */
export function defaultMeasureFor(hint?: MeasureHint | null): ExerciseMeasure {
	if (!hint) return 'reps';
	const names = `${hint.name_ru ?? ''} ${hint.name ?? ''}`;
	if (HOLD_NAME_RE.test(names)) return 'seconds';
	if (isCardioBodyPart(hint.body_part) && STEADY_CARDIO_NAME_RE.test(names)) {
		return 'minutes';
	}
	return 'reps';
}

/** Stored unit, or the catalog default when the plan predates `measure`. */
export function measureOf(
	ex: { measure?: ExerciseMeasure | null },
	hint?: MeasureHint | null
): ExerciseMeasure {
	return ex.measure ?? defaultMeasureFor(hint);
}

/** First duration for a row that switches from reps: 30 сек hold, 20 мин cardio. */
export function durationSeedFor(measure: 'seconds' | 'minutes', reps: number): number {
	if (measure === 'minutes') return 20;
	return reps <= 20 ? 30 : reps;
}

/** Plausible rep count when a duration row goes back to reps (45 сек -> 9, 20 мин -> 10). */
export function repsFromDuration(measure: 'seconds' | 'minutes', value: number): number {
	if (measure === 'minutes') return DEFAULT_REPS;
	return Math.min(20, Math.max(1, Math.round(value / 5)));
}

/**
 * Which duration unit fits this exercise when the athlete asks to time it:
 * cardio counts minutes (a treadmill set is «20 мин»), everything else seconds
 * (a plank is «45 сек»).
 */
export function timingMeasureFor(bodyPart?: string | null): 'seconds' | 'minutes' {
	return isCardioBodyPart(bodyPart) ? 'minutes' : 'seconds';
}

/** i18n key for the duration unit of a measure (reps need no unit). */
export function measureUnitMessageKey(
	measure: ExerciseMeasure
): 'common.sec' | 'common.min' {
	return measure === 'seconds' ? 'common.sec' : 'common.min';
}

/** Plan / preview line: `3 × 10`, `3 × 45 сек`, `3 × 20 мин`; `5 · 5→1` when ladder. */
export function formatExercisePrescription(
	ex: {
		sets: number;
		reps: number;
		repsScheme?: number[] | null;
		measure?: ExerciseMeasure | null;
	},
	units: { seconds?: string; minutes?: string } = {}
): string {
	if (hasLadderScheme(ex) && ex.repsScheme) {
		return `${ex.sets} · ${formatLadderLabel(ex.repsScheme)}`;
	}
	if (ex.measure === 'seconds') return `${ex.sets} × ${ex.reps} ${units.seconds ?? 'сек'}`;
	if (ex.measure === 'minutes') return `${ex.sets} × ${ex.reps} ${units.minutes ?? 'мин'}`;
	return `${ex.sets} × ${ex.reps}`;
}

/** Normalize a stored scheme: clamp reps, drop empties, sync length to SETS.max. */
export function normalizeRepsScheme(scheme: number[]): number[] | null {
	const cleaned = scheme
		.map((n) => Math.min(LADDER_REPS.max, Math.max(LADDER_REPS.min, Math.round(n))))
		.filter((n) => Number.isFinite(n));
	if (cleaned.length < 2) return null;
	return cleaned.slice(0, SETS.max);
}

export type ExerciseRestHint = {
	name?: string;
	name_ru?: string;
	body_part?: string;
	equipment?: string;
};

/** Catalog equipment value for calisthenics / own-body load. */
export function isBodyweightEquipment(equipment: string | null | undefined): boolean {
	return /^body weight$/i.test((equipment ?? '').trim());
}

export { usesExtraKgField } from './homeKit';

/** Catalog zone: machines / conditioning where weight × reps is the wrong log shape. */
export function isCardioBodyPart(bodyPart: string | null | undefined): boolean {
	return /^cardio$/i.test((bodyPart ?? '').trim());
}

const HEAVY_REST_EQ =
	/^(barbell|smith machine|sled machine|olympic barbell|trap bar|hex bar)$/i;

const HEAVY_REST_LIGHT_VARIANT =
	/jump|прыж|split|bulgarian|болгар|one.?leg|single.?leg|pistol|пистолет|goblet|sissy|wall.?sit|curtsy|lunge|выпад/i;

/**
 * Default rest when adding to a plan. Heavy → 180s; soft home gear → 60s; else 90s.
 * Uses catalog EN name + equipment (stable); does not rewrite saved plans.
 */
export function defaultRestSecForExercise(hint?: ExerciseRestHint): number {
	if (!hint?.name) return DEFAULT_REST_SEC;
	if (isHeavyCompoundLift(hint.name, hint.equipment ?? '')) return HEAVY_COMPOUND_REST_SEC;
	if (usesExtraKgField({ equipment: hint.equipment, name: hint.name })) {
		return LIGHT_EQUIPMENT_REST_SEC;
	}
	return DEFAULT_REST_SEC;
}

function isHeavyCompoundLift(name: string, equipment: string): boolean {
	const n = name.trim();
	const eq = equipment.trim();
	if (!n) return false;
	if (HEAVY_REST_LIGHT_VARIANT.test(n)) return false;
	if (/^(band|cable|dumbbell|kettlebell|body weight|assisted)$/i.test(eq)) return false;

	const barbellish =
		HEAVY_REST_EQ.test(eq) || /\b(barbell|smith|trap bar|hex bar)\b/i.test(n) || /\bhack squat\b/i.test(n);
	if (!barbellish) return false;

	if (/\bsquat\b/i.test(n)) return true;
	if (/\bbench press\b/i.test(n)) return true;
	if (/\bdeadlift\b/i.test(n)) return true;
	return false;
}

/**
 * Domain guard: a plank must never open as «Повторы 10» and a treadmill must
 * never open as reps either, while plyometric cardio keeps counting reps.
 */
export function runWorkoutDefaultsSelfCheck(): void {
	const cases: Array<[MeasureHint | null, ExerciseMeasure]> = [
		[null, 'reps'],
		[{ name_ru: 'Планка на предплечьях с отягощением', body_part: 'waist' }, 'seconds'],
		[
			{ name: 'power point plank', name_ru: 'Планка с переходом на предплечья', body_part: 'waist' },
			'seconds'
		],
		[{ name: 'isometric hold', body_part: 'chest' }, 'seconds'],
		[{ name_ru: 'Бег на беговой дорожке', body_part: 'cardio' }, 'minutes'],
		[{ name_ru: 'Ходьба на эллипсе', body_part: 'cardio' }, 'minutes'],
		[{ name_ru: 'Берпи', body_part: 'cardio' }, 'reps'],
		[{ name_ru: 'Присед прыжок', body_part: 'cardio' }, 'reps'],
		[{ name_ru: 'Жим лёжа', body_part: 'chest' }, 'reps']
	];
	for (const [hint, want] of cases) {
		const got = defaultMeasureFor(hint);
		if (got !== want) {
			throw new Error(`workoutDefaults: ${hint?.name_ru ?? 'no hint'} -> ${got}, want ${want}`);
		}
	}

	// An explicit unit (including «по повторам») always beats the catalog default.
	const plank = { name_ru: 'Планка', body_part: 'waist' };
	if (measureOf({ measure: 'reps' }, plank) !== 'reps') {
		throw new Error('workoutDefaults: explicit reps must override the catalog default');
	}
	if (measureOf({}, plank) !== 'seconds') {
		throw new Error('workoutDefaults: unset measure must fall back to the catalog default');
	}

	// Toggle seeds: 10 reps -> 30 сек, 10 reps -> 20 мин, 45 сек -> 9 reps.
	if (durationSeedFor('seconds', 10) !== 30 || durationSeedFor('minutes', 40) !== 20) {
		throw new Error('workoutDefaults: duration seed drift');
	}
	if (repsFromDuration('seconds', 45) !== 9 || repsFromDuration('minutes', 20) !== DEFAULT_REPS) {
		throw new Error('workoutDefaults: reps-from-duration drift');
	}
}
