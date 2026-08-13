import type { AppLocale } from '$lib/i18n/locale';
import type { ExerciseIndexItem } from './types';
import ruOverrides from '$lib/data/exerciseNamesRuOverrides.json' with { type: 'json' };

const RU_OVERRIDES = ruOverrides as Record<string, string>;

/**
 * Catalog `name_ru` is partly machine-translated (mixed EN/RU, awkward order).
 * Prefer curated overrides, then displayable `name_ru`, else English title.
 */
export function exerciseName(
	item: Pick<ExerciseIndexItem, 'id' | 'name' | 'name_ru'> | Pick<ExerciseIndexItem, 'name' | 'name_ru'>,
	locale: AppLocale = 'ru'
): string {
	const english = titleCaseExerciseName(item.name);
	if (locale !== 'ru') return english;

	const id = 'id' in item ? item.id : undefined;
	if (id) {
		const override = RU_OVERRIDES[id];
		if (override) return override;
	}

	const ru = item.name_ru?.trim();
	if (ru && isDisplayableRuName(ru)) return ru;

	return english;
}

export function exerciseNameSortLocale(locale: AppLocale): string {
	return locale === 'ru' ? 'ru' : 'en';
}

/** Reject mixed EN/RU and leftover tokens like `pov`. */
export function isDisplayableRuName(ru: string): boolean {
	const value = ru.trim();
	if (!value) return false;
	if (!/[а-яё]/i.test(value)) return false;
	if (/[A-Za-z]{4,}/.test(value)) return false;
	if (/\bpov\b/i.test(value)) return false;
	return true;
}

function titleCaseExerciseName(raw: string): string {
	return raw
		.trim()
		.split(/\s+/)
		.map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
		.join(' ');
}
