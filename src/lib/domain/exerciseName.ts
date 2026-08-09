import type { AppLocale } from '$lib/i18n/locale';
import type { ExerciseIndexItem } from './types';

/**
 * Catalog `name_ru` is incomplete machine translation (mixed EN/RU, broken word order).
 * Show the English source title everywhere; keep `name_ru` for search only.
 */
export function exerciseName(
	item: Pick<ExerciseIndexItem, 'name' | 'name_ru'>,
	_locale: AppLocale = 'ru'
): string {
	return titleCaseExerciseName(item.name);
}

export function exerciseNameSortLocale(_locale: AppLocale): string {
	return 'en';
}

function titleCaseExerciseName(raw: string): string {
	return raw
		.trim()
		.split(/\s+/)
		.map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
		.join(' ');
}
