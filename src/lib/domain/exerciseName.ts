import type { AppLocale } from '$lib/i18n/locale';
import type { ExerciseIndexItem } from './types';

/** Localized exercise title. */
export function exerciseName(
	item: Pick<ExerciseIndexItem, 'name' | 'name_ru'>,
	locale: AppLocale = 'ru'
): string {
	if (locale === 'ru') {
		const ru = item.name_ru?.trim();
		return ru || item.name;
	}
	return item.name;
}

export function exerciseNameSortLocale(locale: AppLocale): string {
	return locale === 'ru' ? 'ru' : 'en';
}
