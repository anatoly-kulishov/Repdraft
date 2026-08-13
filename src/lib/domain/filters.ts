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

/** Levenshtein edit distance (stdlib only). */
export function editDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = row[0]!;
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const temp = row[j]!;
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			row[j] = Math.min(row[j - 1]! + 1, row[j]! + 1, prev + cost);
			prev = temp;
		}
	}
	return row[b.length]!;
}

function fuzzyMaxDistance(tokenLen: number): number {
	if (tokenLen < 5) return 0;
	if (tokenLen <= 7) return 1;
	return 2;
}

function fuzzyStringsMatch(a: string, b: string): boolean {
	const max = fuzzyMaxDistance(a.length);
	if (max === 0) return false;
	if (Math.abs(a.length - b.length) > max) return false;
	return editDistance(a, b) <= max;
}

const SYNONYM_KEYS = Object.keys(SEARCH_SYNONYMS);

function expandTokenExact(token: string): string[] {
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

function expandTokenFuzzyExtras(token: string, exact: Set<string>): string[] {
	const extras: string[] = [];
	if (fuzzyMaxDistance(token.length) === 0) return extras;
	const probes = new Set([token, ...russianSearchStems(token), ...englishSearchStems(token)]);
	for (const probe of probes) {
		if (probe.length < 5) continue;
		for (const key of SYNONYM_KEYS) {
			if (exact.has(key) || extras.includes(key)) continue;
			if (fuzzyStringsMatch(probe, key)) extras.push(key);
		}
	}
	return extras;
}

function expandToken(token: string): string[] {
	const cached = tokenExpandCache.get(token);
	if (cached) return cached;
	const exactSet = new Set(expandTokenExact(token));
	for (const key of expandTokenFuzzyExtras(token, exactSet)) {
		exactSet.add(key);
		for (const alias of SEARCH_SYNONYMS[key] ?? []) {
			exactSet.add(normalizeSearchText(alias));
		}
	}
	const result = [...exactSet];
	tokenExpandCache.set(token, result);
	return result;
}

function haystackIncludesToken(haystack: string, token: string, variants: string[]): boolean {
	if (variants.some((v) => v.length > 0 && haystack.includes(v))) return true;
	if (fuzzyMaxDistance(token.length) === 0) return false;
	for (const word of haystack.split(' ')) {
		if (word.length < 4) continue;
		if (fuzzyStringsMatch(token, word)) return true;
		for (const stem of russianSearchStems(token)) {
			if (stem.length >= 4 && fuzzyStringsMatch(stem, word)) return true;
		}
	}
	return false;
}

function tokenMatchMode(haystack: string, token: string, variants: string[]): 'exact' | 'fuzzy' | 'miss' {
	if (variants.some((v) => v.length > 0 && haystack.includes(v))) return 'exact';
	if (haystackIncludesToken(haystack, token, variants)) return 'fuzzy';
	return 'miss';
}

type SearchFields = {
	haystack: string;
	name: string;
	nameEn: string;
	nameRu: string;
};

/** ponytail: in-memory cache; catalog is static per session (~1.3k items × 2 locales). */
const searchFieldsCache = new Map<string, SearchFields>();
const tokenExpandCache = new Map<string, string[]>();

function searchFieldsKey(item: ExerciseIndexItem, locale: AppLocale): string {
	return `${item.id}:${locale}`;
}

function getSearchFields(item: ExerciseIndexItem, locale: AppLocale): SearchFields {
	const key = searchFieldsKey(item, locale);
	const hit = searchFieldsCache.get(key);
	if (hit) return hit;
	const fields: SearchFields = {
		haystack: buildHaystack(item, locale),
		name: normalizeSearchText(exerciseName(item, locale)),
		nameEn: normalizeSearchText(item.name),
		nameRu: normalizeSearchText(item.name_ru ?? '')
	};
	searchFieldsCache.set(key, fields);
	return fields;
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

function scoreMatchFields(
	fields: SearchFields,
	query: string,
	tokens: string[],
	tokenVariants: string[][]
): number {
	const { haystack, name, nameEn, nameRu } = fields;

	let fuzzyTokens = 0;
	for (let i = 0; i < tokens.length; i++) {
		const mode = tokenMatchMode(haystack, tokens[i]!, tokenVariants[i]!);
		if (mode === 'miss') return -1;
		if (mode === 'fuzzy') fuzzyTokens++;
	}

	const variants = [...new Set(tokenVariants.flat())];
	const inTitle = (v: string) =>
		v.length > 1 && (name.includes(v) || nameEn.includes(v) || nameRu.includes(v));

	let score = 10;

	if (name === query || nameEn === query || nameRu === query) score += 100;
	else if (name.startsWith(query) || nameEn.startsWith(query) || nameRu.startsWith(query)) score += 70;
	else if (name.includes(query) || nameEn.includes(query) || nameRu.includes(query)) score += 45;
	else if (variants.some(inTitle)) score += 40;
	else if (tokens.every((t) => name.includes(t) || nameEn.includes(t) || nameRu.includes(t))) score += 30;
	else score += 12;

	if (fuzzyTokens > 0) score -= 8 * fuzzyTokens;

	score += Math.max(0, 12 - Math.min(name.length, 24) / 2);

	return score;
}

function scoreMatch(item: ExerciseIndexItem, query: string, tokens: string[], locale: AppLocale): number {
	const fields = getSearchFields(item, locale);
	const tokenVariants = tokens.map((t) => expandToken(t));
	return scoreMatchFields(fields, query, tokens, tokenVariants);
}

function passesFacets(item: ExerciseIndexItem, filters: ExerciseFilters): boolean {
	if (filters.bodyPart !== 'all' && item.body_part !== filters.bodyPart) return false;
	if (filters.equipment !== 'all' && item.equipment !== filters.equipment) return false;
	if (filters.target !== 'all') {
		const primary = item.target === filters.target;
		const secondary = item.secondary_muscles?.includes(filters.target) ?? false;
		if (!primary && !secondary) return false;
	}
	return true;
}

function filterAndSortExercises(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale
): ExerciseIndexItem[] {
	const query = normalizeSearchText(filters.query);
	const tokens = query ? query.split(' ').filter((t) => t.length > 0) : [];
	const tokenVariants = tokens.map((t) => expandToken(t));
	const sortLocale = exerciseNameSortLocale(locale);

	if (!query) {
		return items
			.filter((item) => passesFacets(item, filters))
			.sort((a, b) => exerciseName(a, locale).localeCompare(exerciseName(b, locale), sortLocale));
	}

	return items
		.reduce<{ item: ExerciseIndexItem; score: number }[]>((acc, item) => {
			if (!passesFacets(item, filters)) return acc;
			const fields = getSearchFields(item, locale);
			const score = scoreMatchFields(fields, query, tokens, tokenVariants);
			if (score >= 0) acc.push({ item, score });
			return acc;
		}, [])
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return exerciseName(a.item, locale).localeCompare(exerciseName(b.item, locale), sortLocale);
		})
		.map((row) => row.item);
}

/** One catalog pass: filtered list + facet options (avoids 3× filterExercises per keystroke). */
export function filterCatalogWithFacets(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): { items: ExerciseIndexItem[]; equipment: string[]; targets: string[] } {
	const query = normalizeSearchText(filters.query);
	const tokens = query ? query.split(' ').filter((t) => t.length > 0) : [];
	const tokenVariants = tokens.map((t) => expandToken(t));
	const sortLocale = exerciseNameSortLocale(locale);

	const matched: ExerciseIndexItem[] = [];
	const equipmentPool = new Set<string>();
	const targetPool = new Set<string>();
	const scored: { item: ExerciseIndexItem; score: number }[] = [];

	for (const item of items) {
		if (filters.bodyPart !== 'all' && item.body_part !== filters.bodyPart) continue;

		const fields = getSearchFields(item, locale);
		const queryOk =
			!query ||
			scoreMatchFields(fields, query, tokens, tokenVariants) >= 0;

		if (queryOk) {
			if (filters.target === 'all' || item.target === filters.target || item.secondary_muscles?.includes(filters.target)) {
				equipmentPool.add(item.equipment);
			}
			if (filters.equipment === 'all' || item.equipment === filters.equipment) {
				targetPool.add(item.target);
			}
		}

		if (!passesFacets(item, filters)) continue;
		if (!query) {
			matched.push(item);
			continue;
		}
		const score = scoreMatchFields(fields, query, tokens, tokenVariants);
		if (score >= 0) scored.push({ item, score });
	}

	const resultItems = query
		? scored
				.sort((a, b) => {
					if (b.score !== a.score) return b.score - a.score;
					return exerciseName(a.item, locale).localeCompare(exerciseName(b.item, locale), sortLocale);
				})
				.map((row) => row.item)
		: matched.sort((a, b) =>
				exerciseName(a, locale).localeCompare(exerciseName(b, locale), sortLocale)
			);

	return {
		items: resultItems,
		equipment: [...equipmentPool].sort((a, b) => a.localeCompare(b, 'en')),
		targets: [...targetPool].sort((a, b) => a.localeCompare(b, 'en'))
	};
}

export function filterExercises(
	items: ExerciseIndexItem[],
	filters: ExerciseFilters,
	locale: AppLocale = 'ru'
): ExerciseIndexItem[] {
	return filterAndSortExercises(items, filters, locale);
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

export type TargetChip = { target: string; count: number };

/** Target muscles within a body-part zone, sorted by count desc then slug. */
export function targetCountsForBodyPart(
	items: ExerciseIndexItem[],
	bodyPart: string
): TargetChip[] {
	return targetCountsForZone(items, [bodyPart]);
}

/** Target muscles across one or more body parts (virtual zones). */
export function targetCountsForZone(items: ExerciseIndexItem[], bodyParts: string[]): TargetChip[] {
	const allowed = new Set(bodyParts);
	const counts = new Map<string, number>();
	for (const item of items) {
		if (!allowed.has(item.body_part)) continue;
		counts.set(item.target, (counts.get(item.target) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([target, count]) => ({ target, count }))
		.sort((a, b) => b.count - a.count || a.target.localeCompare(b.target, 'en'));
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
		},
		{
			id: '4',
			name: 'Calf raise',
			body_part: 'lower legs',
			equipment: 'body weight',
			target: 'calves',
			muscle_group: 'calves',
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

	const upperLegChips = targetCountsForZone(catalog, ['upper legs']);
	if (upperLegChips.length < 2) throw new Error('upper legs needs 2+ target chips');
	if (!upperLegChips.some((c) => c.target === 'glutes' && c.count >= 1)) {
		throw new Error('upper legs chips must include glutes');
	}
	const legsChips = targetCountsForZone(catalog, ['upper legs', 'lower legs']);
	if (!legsChips.some((c) => c.target === 'calves')) {
		throw new Error('legs zone chips must include calves');
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

	const bulgarianCatalog: ExerciseIndexItem[] = [
		{
			id: 'bg1',
			name: 'dumbbell single leg split squat',
			name_ru: 'Болгарские выпады с гантелями',
			body_part: 'upper legs',
			equipment: 'dumbbell',
			target: 'quads',
			muscle_group: 'quads',
			secondary_muscles: ['glutes'],
			image: ''
		},
		{
			id: 'ln1',
			name: 'forward lunge',
			name_ru: 'Выпад вперёд',
			body_part: 'upper legs',
			equipment: 'body weight',
			target: 'glutes',
			muscle_group: 'glutes',
			secondary_muscles: [],
			image: ''
		}
	];
	const bgHits = filterExercises(
		bulgarianCatalog,
		{ query: 'Болгарские выпады', bodyPart: 'all', equipment: 'all', target: 'all' },
		'ru'
	);
	if (bgHits.length !== 1 || bgHits[0]!.id !== 'bg1') {
		throw new Error(
			`«Болгарские выпады» should hit only Bulgarian split squat, got ${bgHits.map((i) => i.id).join(',')}`
		);
	}

	const typoHits = filterExercises(
		bulgarianCatalog,
		{ query: 'Болгрские', bodyPart: 'all', equipment: 'all', target: 'all' },
		'ru'
	);
	if (!typoHits.some((h) => h.id === 'bg1')) {
		throw new Error(
			`typo «Болгрские» should include bg1, got ${typoHits.map((i) => i.id).join(',')}`
		);
	}

	const squatHits = filterExercises(
		hammerCatalog,
		{ query: 'присед', bodyPart: 'all', equipment: 'all', target: 'all' },
		'ru'
	);
	if (squatHits.some((h) => h.id === 'h1')) {
		throw new Error('«присед» must not fuzzy-match unrelated hammer exercise');
	}
}
