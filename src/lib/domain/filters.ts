import type { AppLocale } from '$lib/i18n/locale';
import { exerciseName, exerciseNameSortLocale } from './exerciseName';
import { BODY_PART_LABELS, EQUIPMENT_LABELS, TARGET_LABELS } from './labels.ru';
import { SEARCH_SYNONYMS } from './searchSynonyms';
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

/** Strip common RU plural/case endings so «молотки» hits «молот». */
export function russianSearchStems(token: string): string[] {
	const out = new Set<string>([token]);
	if (token.length < 4 || !/[а-я]/i.test(token)) return [...out];

	// Longer endings first. Min stem length 4 keeps «пресс» from collapsing to noise.
	const endings = [
		'ями',
		'ами',
		'иями',
		'ов',
		'ев',
		'ей',
		'ах',
		'ях',
		'ом',
		'ем',
		'ой',
		'ую',
		'юю',
		'ые',
		'ие',
		'ых',
		'их',
		'ая',
		'яя',
		'ое',
		'ее',
		'ый',
		'ий',
		'ки',
		'ка',
		'ку',
		'ке',
		'ы',
		'и',
		'а',
		'я',
		'у',
		'ю',
		'е',
		'о'
	];

	for (const end of endings) {
		if (!token.endsWith(end)) continue;
		const stem = token.slice(0, -end.length);
		if (stem.length >= 4) out.add(stem);
	}

	return [...out];
}

/** Light EN plural / -ing trim for gym tokens (squats → squat). */
function englishSearchStems(token: string): string[] {
	const out = new Set<string>([token]);
	if (token.length < 4 || !/^[a-z]+$/.test(token)) return [...out];
	if (token.endsWith('ies') && token.length > 5) out.add(`${token.slice(0, -3)}y`);
	if (token.endsWith('ses') && token.length > 5) out.add(token.slice(0, -2));
	if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) out.add(token.slice(0, -1));
	if (token.endsWith('ing') && token.length > 6) out.add(token.slice(0, -3));
	return [...out];
}

function synonymKeyMatches(stem: string, key: string): boolean {
	if (stem === key || stem.startsWith(key)) return true;
	// Allow short suffixes on the key (гантел→гантели), not long ones (молот→молотковые).
	return key.startsWith(stem) && key.length - stem.length <= 2;
}

function expandToken(token: string): string[] {
	const out = new Set<string>([...russianSearchStems(token), ...englishSearchStems(token)]);
	for (const stem of [...out]) {
		for (const [key, aliases] of Object.entries(SEARCH_SYNONYMS)) {
			if (!synonymKeyMatches(stem, key)) continue;
			out.add(key);
			for (const a of aliases) out.add(normalizeSearchText(a));
		}
		for (const [key, aliases] of Object.entries(SEARCH_SYNONYMS)) {
			for (const a of aliases) {
				const na = normalizeSearchText(a);
				if (!(stem === na || stem.startsWith(na) || (na.startsWith(stem) && na.length - stem.length <= 2))) {
					continue;
				}
				out.add(key);
				out.add(na);
				for (const b of aliases) out.add(normalizeSearchText(b));
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

	const variants = [...new Set(tokens.flatMap((t) => expandToken(t)))];
	const inTitle = (v: string) =>
		v.length > 1 && (name.includes(v) || nameEn.includes(v) || nameRu.includes(v));

	let score = 10;

	if (name === query || nameEn === query || nameRu === query) score += 100;
	else if (name.startsWith(query) || nameEn.startsWith(query) || nameRu.startsWith(query)) score += 70;
	else if (name.includes(query) || nameEn.includes(query) || nameRu.includes(query)) score += 45;
	else if (variants.some(inTitle)) score += 40;
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

/** Throws if cascade / conflict / AND-filter invariants regress. */
export function runFiltersSelfCheck(): void {
	const catalog: ExerciseIndexItem[] = [
		{
			id: '1',
			name: 'Squat',
			body_part: 'upper legs',
			equipment: 'band',
			target: 'quads',
			muscle_group: 'quads',
			secondary_muscles: [],
			image: 'x.jpg'
		},
		{
			id: '2',
			name: 'Bench',
			body_part: 'chest',
			equipment: 'band',
			target: 'pectorals',
			muscle_group: 'chest',
			secondary_muscles: [],
			image: 'x.jpg'
		},
		{
			id: '3',
			name: 'Hip thrust',
			body_part: 'upper legs',
			equipment: 'barbell',
			target: 'glutes',
			muscle_group: 'glutes',
			secondary_muscles: [],
			image: 'x.jpg'
		}
	];

	const base: ExerciseFilters = {
		query: '',
		bodyPart: 'upper legs',
		equipment: 'all',
		target: 'all'
	};

	const targets = availableTargets(catalog, base, 'en');
	if (targets.includes('pectorals')) throw new Error('pectorals must not appear under upper legs');
	if (!targets.includes('quads') || !targets.includes('glutes')) {
		throw new Error(`expected quads/glutes, got ${targets.join(',')}`);
	}

	const conflictFilters: ExerciseFilters = {
		query: '',
		bodyPart: 'upper legs',
		equipment: 'all',
		target: 'pectorals'
	};
	if (!isFilterConflict(catalog, conflictFilters, 'en')) {
		throw new Error('legs + pectorals should conflict');
	}
	if (isFilterConflict(catalog, { ...base, target: 'quads' }, 'en')) {
		throw new Error('legs + quads must not conflict');
	}

	const andHits = filterExercises(
		catalog,
		{ query: 'squat', bodyPart: 'upper legs', equipment: 'band', target: 'quads' },
		'en'
	);
	if (andHits.length !== 1 || andHits[0]!.id !== '1') {
		throw new Error(`AND filter expected squat only, got ${andHits.map((i) => i.id).join(',')}`);
	}

	const hammerCatalog: ExerciseIndexItem[] = [
		{
			id: 'h1',
			name: 'Sledge Hammer',
			body_part: 'waist',
			equipment: 'hammer',
			target: 'abs',
			muscle_group: 'abs',
			secondary_muscles: [],
			image: 'x.jpg'
		},
		{
			id: 'h2',
			name: 'Dumbbell Curl',
			body_part: 'upper arms',
			equipment: 'dumbbell',
			target: 'biceps',
			muscle_group: 'biceps',
			secondary_muscles: [],
			image: 'x.jpg'
		},
		{
			id: 'h3',
			name: 'Barbell Romanian Deadlift',
			body_part: 'upper legs',
			equipment: 'barbell',
			target: 'hamstrings',
			muscle_group: 'hamstrings',
			secondary_muscles: [],
			image: 'x.jpg'
		},
		{
			id: 'h4',
			name: 'Assisted Parallel Close Grip Dip',
			body_part: 'upper arms',
			equipment: 'assisted',
			target: 'triceps',
			muscle_group: 'triceps',
			secondary_muscles: [],
			image: 'x.jpg'
		}
	];

	if (!russianSearchStems('молотки').includes('молот')) {
		throw new Error('russianSearchStems should strip ки → молот');
	}
	if (!russianSearchStems('молоты').includes('молот')) {
		throw new Error('russianSearchStems should strip ы → молот');
	}

	for (const q of ['молот', 'молотки', 'молоты', 'hammer']) {
		const hits = filterExercises(
			hammerCatalog,
			{ query: q, bodyPart: 'all', equipment: 'all', target: 'all' },
			'ru'
		);
		if (hits.length !== 1 || hits[0]!.id !== 'h1') {
			throw new Error(
				`query «${q}» should return only Sledge Hammer, got ${hits.map((i) => i.id).join(',')}`
			);
		}
	}

	const cases: Array<{ q: string; id: string }> = [
		{ q: 'румынская', id: 'h3' },
		{ q: 'брусья', id: 'h4' },
		{ q: 'бицуха', id: 'h2' },
		{ q: 'гантели', id: 'h2' }
	];

	for (const { q, id } of cases) {
		const hits = filterExercises(
			hammerCatalog,
			{ query: q, bodyPart: 'all', equipment: 'all', target: 'all' },
			'ru'
		);
		if (!hits.some((h) => h.id === id)) {
			throw new Error(`query «${q}» should include ${id}, got ${hits.map((i) => i.id).join(',')}`);
		}
	}
}
