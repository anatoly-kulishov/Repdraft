import type { AppLocale } from '$lib/i18n/locale';
import { exerciseName, exerciseNameSortLocale } from './exerciseName';
import type { BodyPart, ExerciseFilters, ExerciseIndexItem } from './types';

export function uniqueSorted(
	items: ExerciseIndexItem[],
	key: keyof Pick<ExerciseIndexItem, 'body_part' | 'equipment' | 'target'>
): string[] {
	return [...new Set(items.map((item) => item[key]))].sort((a, b) => a.localeCompare(b, 'en'));
}

export function filterExercises(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): ExerciseIndexItem[] {
	const query = filters.query.trim().toLowerCase();

	const filtered = items.filter((item) => {
		if (filters.bodyPart !== 'all' && item.body_part !== filters.bodyPart) return false;
		if (filters.equipment !== 'all' && item.equipment !== filters.equipment) return false;
		if (filters.target !== 'all' && item.target !== filters.target) return false;

		if (!query) return true;

		const display = exerciseName(item, locale).toLowerCase();
		return (
			display.includes(query) ||
			item.name.toLowerCase().includes(query) ||
			(item.name_ru ?? '').toLowerCase().includes(query) ||
			item.target.toLowerCase().includes(query) ||
			item.equipment.toLowerCase().includes(query) ||
			item.body_part.toLowerCase().includes(query)
		);
	});

	const sortLocale = exerciseNameSortLocale(locale);
	return filtered.sort((a, b) =>
		exerciseName(a, locale).localeCompare(exerciseName(b, locale), sortLocale)
	);
}

export function isBodyPart(value: string): value is BodyPart {
	return (
		value === 'back' ||
		value === 'cardio' ||
		value === 'chest' ||
		value === 'lower arms' ||
		value === 'lower legs' ||
		value === 'neck' ||
		value === 'shoulders' ||
		value === 'upper arms' ||
		value === 'upper legs' ||
		value === 'waist'
	);
}
