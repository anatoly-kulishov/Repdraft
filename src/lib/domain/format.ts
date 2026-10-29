/**
 * Pure number formatting for surfaces that must obey strict typography rules.
 * Web + RN shared. No "т" abbreviation for tons — always kg with a thin-space
 * thousands separator (e.g. 212 567 кг) to avoid the semantic clash.
 */

/** Thin space U+202F used as the thousands group separator. */
export const THIN_SPACE = '\u202f';

/** Group a positive or negative number with thin spaces: 212567 → "212 567". */
export function groupThousands(value: number): string {
	const sign = value < 0 ? '-' : '';
	const abs = Math.abs(Math.round(value));
	const digits = String(abs);
	const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
	return sign + out;
}

/**
 * Round to a clean display weight (integer, or one decimal when needed):
 * 70 → "70", 67.5 → "67.5", 67.54 → "67.5".
 */
export function roundWeight(kg: number): string {
	const rounded = Math.round(kg * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Format an integral weight in kg with thin-space grouping and no fractions:
 * 212567 → "212 567". Use for big totals (Всего поднято, week volume).
 */
export function formatKgInt(kg: number): string {
	return groupThousands(Math.round(kg));
}