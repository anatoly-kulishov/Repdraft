/** Shared numeric bounds for workout / PR inputs. */

export const WEIGHT_KG = { min: 0, max: 999, step: 0.5 } as const;
export const REPS = { min: 1, max: 999 } as const;
export const LIVE_REPS = { min: 0, max: 999 } as const;
export const SETS = { min: 1, max: 99 } as const;
export const REST_SEC = { min: 0, max: 999 } as const;
/** PR / record note — one line in list chips; keeps cards from ballooning. */
export const NOTE_MAX = 60;
/** Builder / plan title — keeps cards and headers from overflowing. */
export const PLAN_NAME_MAX = 48;
/** Catalog / workouts / articles search — soft cap while typing. */
export const SEARCH_QUERY_MAX = 80;

/** Max digits while typing (derived from bounds — fits chip inputs without overflow). */
export const SETS_INPUT_MAX_LEN = String(SETS.max).length;
export const REPS_INPUT_MAX_LEN = String(REPS.max).length;
export const REST_INPUT_MAX_LEN = String(REST_SEC.max).length;
export const WEIGHT_INPUT_MAX_LEN = String(WEIGHT_KG.max).length + 1;

/** Digits + optional one decimal; empty crumbs → ''. Does not clamp to max. */
function shapeWeight(raw: string): string {
	let s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
	if (!s) return '';
	const hasDot = s.includes('.');
	const [rawInt = '', rawDec = ''] = s.split('.');
	const intMaxLen = String(WEIGHT_KG.max).length;
	const intPart = rawInt.replace(/^0+(?=\d)/, '').slice(0, intMaxLen);
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
 * auto-replacing overflow with max.
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
	if (!allowZero && /^0+$/.test(digits)) return '';
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
	if (!raw.replace(/\D/g, '')) return '';
	const candidate = shapeReps(raw, allowZero);
	if (!candidate) {
		const prev = shapeReps(previous, allowZero);
		if (prev && !repsOverMax(prev, bounds.max)) return prev;
		return '';
	}
	if (!repsOverMax(candidate, bounds.max)) return candidate;
	const prev = shapeReps(previous, allowZero);
	if (prev && !repsOverMax(prev, bounds.max)) return prev;
	return longestValidReps(candidate, bounds.max, allowZero);
}

/** Builder sets chip — digits only, reject overflow instead of snapping to max. */
export function filterSetsInput(raw: string, previous = ''): string {
	return filterRepsInput(raw, SETS, previous);
}

/** Builder rest chip — allows 0, caps at REST_SEC.max (999 s). */
export function filterRestSecInput(raw: string, previous = ''): string {
	return filterRepsInput(raw, REST_SEC, previous);
}

/** Persisted kg → draft string (clamps junk / overflow from legacy data). */
export function clampStoredWeightKg(kg: number): number {
	if (!Number.isFinite(kg)) return WEIGHT_KG.min;
	return Math.min(WEIGHT_KG.max, Math.max(WEIGHT_KG.min, Math.round(kg * 10) / 10));
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

/** While typing: strip control chars and hard-cap (no trim — keeps caret stable). */
export function clampNote(raw: string, maxLen = NOTE_MAX): string {
	return raw.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, maxLen);
}

/** Persist / display: collapse whitespace and trim. */
export function sanitizeNote(raw: string, maxLen = NOTE_MAX): string {
	return clampNote(raw, maxLen).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/** While typing: strip control chars and hard-cap length (no trim — keeps caret stable). */
export function clampPlanName(raw: string, maxLen = PLAN_NAME_MAX): string {
	return raw.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLen);
}

/** Search fields: strip control chars, soft-cap length (no trim while typing). */
export function clampSearchQuery(raw: string, maxLen = SEARCH_QUERY_MAX): string {
	return raw.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLen);
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

/** Quick-adjust weight without typing (null treated as 0). */
export function nudgeWeightKg(current: number | null, delta: number): number {
	const base = current ?? 0;
	const next = Math.round((base + delta) * 10) / 10;
	return Math.min(WEIGHT_KG.max, Math.max(WEIGHT_KG.min, next));
}

/** Quick-adjust reps without typing (null treated as bounds.min). */
export function nudgeReps(
	current: number | null,
	delta: number,
	bounds: { min: number; max: number } = LIVE_REPS
): number {
	const base = current ?? bounds.min;
	const next = Math.round(base + delta);
	return Math.min(bounds.max, Math.max(bounds.min, next));
}

/** Throws if weight/reps coerce bounds regress. */
export function runInputLimitsSelfCheck(): void {
	if (coerceWeightKg('80') !== 80) throw new Error('coerceWeightKg 80');
	if (coerceWeightKg('80.56') !== 80.6) throw new Error('coerceWeightKg round');
	if (clampStoredWeightKg(100_000) !== 999) throw new Error('clampStoredWeightKg overflow');
	if (coerceWeightKg('501') !== 501) throw new Error('coerceWeightKg 501');
	if (coerceWeightKg('1000') !== null) throw new Error('coerceWeightKg over max');
	if (coerceWeightKg('') !== null) throw new Error('coerceWeightKg empty');
	if (coerceWeightKg('12.') !== 12) throw new Error('coerceWeightKg trailing dot');

	if (coerceReps('8') !== 8) throw new Error('coerceReps 8');
	if (coerceReps('0', LIVE_REPS) !== 0) throw new Error('live reps allow 0');
	if (coerceReps('0', REPS) !== 1) throw new Error('PR reps clamp min to 1');
	if (coerceReps('999', REPS) !== 999) throw new Error('coerceReps clamp max');
	if (coerceReps('x') !== null) throw new Error('coerceReps junk');
	if (filterRepsInput('8', LIVE_REPS, '') !== '8') throw new Error('filterRepsInput keep');
	if (filterRepsInput('10001', LIVE_REPS, '999') !== '999') {
		throw new Error('filterRepsInput reject extra digit');
	}
	if (nudgeWeightKg(100, 2.5) !== 102.5) throw new Error('nudgeWeightKg +2.5');
	if (nudgeWeightKg(null, 5) !== 5) throw new Error('nudgeWeightKg from empty');
	if (nudgeWeightKg(1, -5) !== 0) throw new Error('nudgeWeightKg floor');
	if (nudgeReps(8, 1, LIVE_REPS) !== 9) throw new Error('nudgeReps +1');
	if (nudgeReps(null, 1, LIVE_REPS) !== 1) throw new Error('nudgeReps from empty');
	if (nudgeReps(0, -1, LIVE_REPS) !== 0) throw new Error('nudgeReps floor');
	if (filterRepsInput('1000', LIVE_REPS, '') !== '100') {
		throw new Error('filterRepsInput longest valid prefix');
	}
	if (filterSetsInput('100', '99') !== '99') {
		throw new Error('filterSetsInput reject extra digit');
	}
	if (filterSetsInput('0', '3') !== '3') {
		throw new Error('filterSetsInput reject lone zero');
	}
	if (filterRepsInput('0', REPS, '10') !== '10') {
		throw new Error('filterRepsInput reject lone zero for builder reps');
	}
	if (filterRepsInput('0', LIVE_REPS, '') !== '0') {
		throw new Error('filterRepsInput allow zero in live');
	}
	if (coerceSets('0') !== 1) throw new Error('coerceSets lone zero to min');
	if (coerceSets('') !== 1) throw new Error('coerceSets empty to min');
	if (coerceSets('99') !== 99) throw new Error('coerceSets max');
	if (filterRestSecInput('1000', '999') !== '999') {
		throw new Error('filterRestSecInput reject extra digit');
	}
	if (filterRestSecInput('0', '') !== '0') {
		throw new Error('filterRestSecInput allow zero');
	}

	if (coerceWeightKg('-11') !== null) throw new Error('coerceWeightKg rejects negative');
	if (filterWeightInput('-11', '') !== '11') {
		throw new Error('filterWeightInput should strip minus');
	}
	if (filterWeightInput('12345', '') !== '123') {
		throw new Error('filterWeightInput caps integer digits');
	}
	if (filterWeightInput('9999', '999') !== '999') {
		throw new Error('filterWeightInput rejects digit past max');
	}
	if (sanitizeNote('  a\nb  ') !== 'a b') throw new Error('sanitizeNote whitespace');
	if (sanitizeNote('x'.repeat(150)).length !== NOTE_MAX) {
		throw new Error('sanitizeNote max length');
	}
	if (clampNote('  a\nb  ') !== '  a b  ') {
		throw new Error('clampNote keeps edges while typing');
	}
	if (clampNote('x'.repeat(150)).length !== NOTE_MAX) {
		throw new Error('clampNote max length');
	}
	if (clampPlanName('x'.repeat(80)).length !== PLAN_NAME_MAX) {
		throw new Error('clampPlanName max length');
	}
	if (clampPlanName('  ab  ') !== '  ab  ') {
		throw new Error('clampPlanName keeps spaces while typing');
	}
	if (clampSearchQuery('x'.repeat(120)).length !== SEARCH_QUERY_MAX) {
		throw new Error('clampSearchQuery max length');
	}
	if (clampSearchQuery('a\u0007b').length !== 2) {
		throw new Error('clampSearchQuery strips controls');
	}
}
