/** Shared numeric bounds for workout / PR inputs. */

export const WEIGHT_KG = { min: 0, max: 500, step: 0.5 } as const;
export const REPS = { min: 1, max: 500 } as const;
export const LIVE_REPS = { min: 0, max: 500 } as const;
export const SETS = { min: 1, max: 20 } as const;
export const REST_SEC = { min: 0, max: 600 } as const;
export const NOTE_MAX = 200;

/** Digits + optional one decimal; empty crumbs → ''. Does not clamp to max. */
function shapeWeight(raw: string): string {
	let s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
	if (!s) return '';
	const hasDot = s.includes('.');
	const [rawInt = '', rawDec = ''] = s.split('.');
	const intPart = rawInt.replace(/^0+(?=\d)/, '');
	const decPart = hasDot ? rawDec.replace(/\D/g, '').slice(0, 1) : null;
	if (hasDot) return `${intPart}.${decPart ?? ''}`;
	return intPart;
}

function weightOverMax(s: string): boolean {
	if (!s || s === '.') return false;
	const n = Number(s.endsWith('.') ? s.slice(0, -1) : s);
	return Number.isFinite(n) && n > WEIGHT_KG.max;
}

function longestValidWeight(shaped: string): string {
	for (let i = shaped.length; i >= 0; i--) {
		const slice = shapeWeight(shaped.slice(0, i));
		if (!slice) continue;
		if (!weightOverMax(slice)) return slice;
	}
	return '';
}

/**
 * Mask-style weight filter: keep previous value (or longest valid prefix) instead of
 * auto-replacing overflow with 500.
 */
export function filterWeightInput(raw: string, previous = ''): string {
	const candidate = shapeWeight(raw);
	if (!candidate) return '';
	if (!weightOverMax(candidate)) return candidate;
	const prev = shapeWeight(previous);
	if (prev && !weightOverMax(prev)) return prev;
	return longestValidWeight(candidate);
}

function shapeReps(raw: string, allowZero: boolean): string {
	const digits = raw.replace(/\D/g, '');
	if (!digits) return '';
	const trimmed = digits.replace(/^0+(?=\d)/, '');
	if (!trimmed) return allowZero ? '0' : '';
	return trimmed;
}

function repsOverMax(s: string, max: number): boolean {
	if (!s) return false;
	const n = Number(s);
	return Number.isFinite(n) && n > max;
}

function longestValidReps(shaped: string, max: number, allowZero: boolean): string {
	for (let i = shaped.length; i >= 0; i--) {
		const slice = shapeReps(shaped.slice(0, i), allowZero);
		if (!slice) continue;
		if (!repsOverMax(slice, max)) return slice;
	}
	return '';
}

/** Digits-only mask; rejects overflow instead of snapping to max. */
export function filterRepsInput(
	raw: string,
	bounds: { min: number; max: number } = REPS,
	previous = ''
): string {
	const allowZero = bounds.min === 0;
	const candidate = shapeReps(raw, allowZero);
	if (!candidate) return '';
	if (!repsOverMax(candidate, bounds.max)) return candidate;
	const prev = shapeReps(previous, allowZero);
	if (prev && !repsOverMax(prev, bounds.max)) return prev;
	return longestValidReps(candidate, bounds.max, allowZero);
}

/** Empty → null. Out of range / junk → null. */
export function coerceWeightKg(raw: string): number | null {
	const trimmed = raw.trim().replace(',', '.');
	if (!trimmed || trimmed === '-' || trimmed === '.') return null;
	// Allow "80." while typing; reject scientific notation / junk.
	if (!/^-?\d+(\.\d*)?$/.test(trimmed)) return null;
	const n = Number(trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed);
	if (!Number.isFinite(n)) return null;
	if (n < WEIGHT_KG.min || n > WEIGHT_KG.max) return null;
	return Math.round(n * 10) / 10;
}

export function coerceReps(raw: string, bounds: { min: number; max: number } = REPS): number | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (!/^\d+$/.test(trimmed)) return null;
	const n = Math.round(Number(trimmed));
	if (!Number.isFinite(n)) return null;
	return Math.min(bounds.max, Math.max(bounds.min, n));
}

export function coerceSets(raw: string): number {
	return coerceReps(raw, SETS) ?? SETS.min;
}

export function coerceRestSec(raw: string): number {
	const trimmed = raw.trim();
	if (!trimmed) return REST_SEC.min;
	if (!/^\d+$/.test(trimmed)) return REST_SEC.min;
	const n = Math.round(Number(trimmed));
	if (!Number.isFinite(n)) return REST_SEC.min;
	return Math.min(REST_SEC.max, Math.max(REST_SEC.min, n));
}

export function sanitizeNote(raw: string, maxLen = NOTE_MAX): string {
	return raw
		.replace(/[\u0000-\u001F\u007F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLen);
}

export function isValidWeightKg(value: number | null): boolean {
	if (value == null) return true;
	return Number.isFinite(value) && value >= WEIGHT_KG.min && value <= WEIGHT_KG.max;
}

export function isValidReps(
	value: number | null,
	bounds: { min: number; max: number } = REPS,
	required = false
): boolean {
	if (value == null) return !required;
	return Number.isInteger(value) && value >= bounds.min && value <= bounds.max;
}

/** Throws if weight/reps coerce bounds regress. */
export function runInputLimitsSelfCheck(): void {
	if (coerceWeightKg('80') !== 80) throw new Error('coerceWeightKg 80');
	if (coerceWeightKg('80.56') !== 80.6) throw new Error('coerceWeightKg round');
	if (coerceWeightKg('501') !== null) throw new Error('coerceWeightKg over max');
	if (coerceWeightKg('') !== null) throw new Error('coerceWeightKg empty');
	if (coerceWeightKg('12.') !== 12) throw new Error('coerceWeightKg trailing dot');

	if (coerceReps('8') !== 8) throw new Error('coerceReps 8');
	if (coerceReps('0', LIVE_REPS) !== 0) throw new Error('live reps allow 0');
	if (coerceReps('0', REPS) !== 1) throw new Error('PR reps clamp min to 1');
	if (coerceReps('999', REPS) !== 500) throw new Error('coerceReps clamp max');
	if (coerceReps('x') !== null) throw new Error('coerceReps junk');
	if (filterRepsInput('8', LIVE_REPS, '') !== '8') throw new Error('filterRepsInput keep');
	if (filterRepsInput('5001', LIVE_REPS, '500') !== '500') {
		throw new Error('filterRepsInput reject extra digit');
	}
	if (filterRepsInput('501', LIVE_REPS, '') !== '50') {
		throw new Error('filterRepsInput longest valid prefix');
	}

	if (coerceWeightKg('-11') !== null) throw new Error('coerceWeightKg rejects negative');
	if (filterWeightInput('-11', '') !== '11') {
		throw new Error('filterWeightInput should strip minus');
	}
	if (sanitizeNote('  a\nb  ') !== 'a b') throw new Error('sanitizeNote whitespace');
}
