import { LADDER_REPS, SETS } from './inputLimits';

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_SEC = 90;
/** Squat / bench / deadlift family — longer recovery between heavy sets. */
export const HEAVY_COMPOUND_REST_SEC = 180;

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

/** Plan / preview line: `3 × 10` or `5 · 5→1` when ladder. */
export function formatExercisePrescription(ex: {
	sets: number;
	reps: number;
	repsScheme?: number[] | null;
}): string {
	if (hasLadderScheme(ex) && ex.repsScheme) {
		return `${ex.sets} · ${formatLadderLabel(ex.repsScheme)}`;
	}
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
	equipment?: string;
};

/** Catalog equipment value for calisthenics / own-body load. */
export function isBodyweightEquipment(equipment: string | null | undefined): boolean {
	return /^body weight$/i.test((equipment ?? '').trim());
}

/** Catalog zone: machines / conditioning where weight × reps is the wrong log shape. */
export function isCardioBodyPart(bodyPart: string | null | undefined): boolean {
	return /^cardio$/i.test((bodyPart ?? '').trim());
}

const HEAVY_REST_EQ =
	/^(barbell|smith machine|sled machine|olympic barbell|trap bar|hex bar)$/i;

const HEAVY_REST_LIGHT_VARIANT =
	/jump|прыж|split|bulgarian|болгар|one.?leg|single.?leg|pistol|пистолет|goblet|sissy|wall.?sit|curtsy|lunge|выпад/i;

/**
 * Default rest when adding to a plan. Heavy barbell/smith compounds → 180s; else 90s.
 * Uses catalog EN name + equipment (stable); does not rewrite saved plans.
 */
export function defaultRestSecForExercise(hint?: ExerciseRestHint): number {
	if (!hint?.name) return DEFAULT_REST_SEC;
	return isHeavyCompoundLift(hint.name, hint.equipment ?? '')
		? HEAVY_COMPOUND_REST_SEC
		: DEFAULT_REST_SEC;
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
