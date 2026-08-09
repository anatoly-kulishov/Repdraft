import type { AppLocale } from '$lib/i18n/locale';
import { exerciseName, exerciseNameSortLocale } from './exerciseName';
import { BODY_PART_LABELS, EQUIPMENT_LABELS, TARGET_LABELS } from './labels.ru';
import type { BodyPart, ExerciseFilters, ExerciseIndexItem } from './types';

export function uniqueSorted(
	items: ExerciseIndexItem[],
	key: keyof Pick<ExerciseIndexItem, 'body_part' | 'equipment' | 'target'>
): string[] {
	return [...new Set(items.map((item) => item[key]))].sort((a, b) => a.localeCompare(b, 'en'));
}

/** ё→е, collapse spaces, strip most punctuation. */
export function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.replace(/ё/g, 'е')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Common RU/EN gym aliases → tokens that should also match.
 * Kept small on purpose; extend when users complain.
 */
const SYNONYMS: Record<string, string[]> = {
	жим: ['press', 'bench', 'chest', 'push'],
	присед: ['squat', 'squats'],
	приседания: ['squat', 'squats'],
	тяга: ['deadlift', 'row', 'pull', 'rdl'],
	становая: ['deadlift'],
	гантел: ['dumbbell', 'dumbbells'],
	гантели: ['dumbbell', 'dumbbells'],
	штанга: ['barbell'],
	штан: ['barbell'],
	гиря: ['kettlebell'],
	гир: ['kettlebell'],
	пресс: ['abs', 'waist', 'crunch', 'core'],
	скручивания: ['crunch', 'abs'],
	спина: ['back', 'lats', 'row'],
	ноги: ['legs', 'quads', 'squat', 'lunge'],
	плечи: ['shoulders', 'delts', 'press'],
	бицепс: ['biceps', 'curl'],
	трицепс: ['triceps', 'extension'],
	отжимания: ['push up', 'pushup', 'push-up', 'chest'],
	отжим: ['push up', 'pushup', 'chest'],
	подтягивания: ['pull up', 'pullup', 'chin', 'lats'],
	подтяг: ['pull up', 'pullup', 'lats'],
	выпад: ['lunge'],
	выпады: ['lunge'],
	планка: ['plank', 'core'],
	кардио: ['cardio', 'run', 'bike'],
	резинка: ['band', 'resistance'],
	резин: ['band'],
	блок: ['cable'],
	кроссовер: ['cable', 'crossover'],
	смит: ['smith'],
	ягодиц: ['glutes', 'hip'],
	икры: ['calves'],
	грудь: ['chest', 'pectorals', 'bench'],
	руки: ['arms', 'biceps', 'triceps'],
	кор: ['core', 'abs', 'waist'],
	разведен: ['fly', 'flye', 'pec']
};

function expandToken(token: string): string[] {
	const out = new Set<string>([token]);
	for (const [key, aliases] of Object.entries(SYNONYMS)) {
		if (token === key || token.startsWith(key) || key.startsWith(token)) {
			for (const a of aliases) out.add(normalizeSearchText(a));
			out.add(key);
		}
		for (const a of aliases) {
			const na = normalizeSearchText(a);
			if (token === na || token.startsWith(na) || na.startsWith(token)) {
				out.add(key);
				out.add(na);
			}
		}
	}
	return [...out];
}

function buildHaystack(item: ExerciseIndexItem, locale: AppLocale): string {
	const parts = [
		exerciseName(item, locale),
		item.name,
		item.name_ru ?? '',
		item.body_part,
		item.equipment,
		item.target,
		item.muscle_group,
		...(item.secondary_muscles ?? []),
		BODY_PART_LABELS[item.body_part] ?? '',
		EQUIPMENT_LABELS[item.equipment] ?? '',
		TARGET_LABELS[item.target] ?? '',
		...(item.secondary_muscles ?? []).map((m) => TARGET_LABELS[m] ?? m)
	];
	return normalizeSearchText(parts.join(' '));
}

function tokenMatches(haystack: string, token: string): boolean {
	const variants = expandToken(token);
	return variants.some((v) => v.length > 0 && haystack.includes(v));
}

function scoreMatch(item: ExerciseIndexItem, query: string, tokens: string[], locale: AppLocale): number {
	const name = normalizeSearchText(exerciseName(item, locale));
	const nameEn = normalizeSearchText(item.name);
	const nameRu = normalizeSearchText(item.name_ru ?? '');
	const haystack = buildHaystack(item, locale);

	if (!tokens.every((t) => tokenMatches(haystack, t))) return -1;

	let score = 10;

	if (name === query || nameEn === query || nameRu === query) score += 100;
	else if (name.startsWith(query) || nameEn.startsWith(query) || nameRu.startsWith(query)) score += 70;
	else if (name.includes(query) || nameEn.includes(query) || nameRu.includes(query)) score += 45;
	else if (tokens.every((t) => name.includes(t) || nameEn.includes(t) || nameRu.includes(t))) score += 30;
	else score += 12;

	// Prefer shorter titles when equally related (tighter match)
	score += Math.max(0, 12 - Math.min(name.length, 24) / 2);

	return score;
}

export function filterExercises(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): ExerciseIndexItem[] {
	const query = normalizeSearchText(filters.query);
	const tokens = query ? query.split(' ').filter((t) => t.length > 0) : [];

	const filtered = items.filter((item) => {
		if (filters.bodyPart !== 'all' && item.body_part !== filters.bodyPart) return false;
		if (filters.equipment !== 'all' && item.equipment !== filters.equipment) return false;
		if (filters.target !== 'all' && item.target !== filters.target) return false;
		if (!query) return true;
		return scoreMatch(item, query, tokens, locale) >= 0;
	});

	const sortLocale = exerciseNameSortLocale(locale);

	if (!query) {
		return filtered.sort((a, b) =>
			exerciseName(a, locale).localeCompare(exerciseName(b, locale), sortLocale)
		);
	}

	return filtered
		.map((item) => ({ item, score: scoreMatch(item, query, tokens, locale) }))
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return exerciseName(a.item, locale).localeCompare(exerciseName(b.item, locale), sortLocale);
		})
		.map((row) => row.item);
}

/** Targets present if body/equipment/query stay, ignoring the muscle facet (AND cascade). */
export function availableTargets(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): string[] {
	const pool = filterExercises(items, { ...filters, target: 'all' }, locale);
	return uniqueSorted(pool, 'target');
}

/** Equipment present if body/query stay (and target if set). */
export function availableEquipment(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): string[] {
	const pool = filterExercises(items, { ...filters, equipment: 'all' }, locale);
	return uniqueSorted(pool, 'equipment');
}

/**
 * True when body part + muscle (and optionally equipment) AND to empty,
 * but each of body/muscle alone still has hits — classic hierarchy clash.
 */
export function isFilterConflict(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): boolean {
	if (filterExercises(items, filters, locale).length > 0) return false;
	const facetCount =
		(filters.bodyPart !== 'all' ? 1 : 0) +
		(filters.equipment !== 'all' ? 1 : 0) +
		(filters.target !== 'all' ? 1 : 0);
	if (facetCount < 2) return false;

	if (filters.bodyPart !== 'all' && filters.target !== 'all') {
		const bodyOnly = filterExercises(
			items,
			{ query: '', bodyPart: filters.bodyPart, equipment: 'all', target: 'all' },
			locale
		);
		const targetOnly = filterExercises(
			items,
			{ query: '', bodyPart: 'all', equipment: 'all', target: filters.target },
			locale
		);
		if (bodyOnly.length > 0 && targetOnly.length > 0) return true;
	}

	// Other multi-facet empties (e.g. equipment ∩ body) — still a “conflict” for UX copy
	return facetCount >= 2;
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
