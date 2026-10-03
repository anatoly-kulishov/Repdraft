import { newId } from './id';
import { BODY_PART_LABELS, EQUIPMENT_LABELS } from './labels.ru';
import type { ExerciseIndexItem } from './types';

export const CUSTOM_EXERCISE_ID_PREFIX = 'custom-';
export const CUSTOM_EXERCISE_NAME_MAX = 48;
export const MAX_CUSTOM_EXERCISES = 100;
/** Placeholder thumb for local exercises (precached with /images/*). */
export const CUSTOM_EXERCISE_IMAGE = 'images/custom-exercise.svg';

/** Common catalog equipment values — labels + rest hints stay consistent. */
export const CUSTOM_EXERCISE_EQUIPMENT = [
	'body weight',
	'barbell',
	'dumbbell',
	'kettlebell',
	'ez barbell',
	'cable',
	'leverage machine',
	'smith machine',
	'resistance band',
	'medicine ball'
] as const;

const BODY_PART_VALUES = Object.keys(BODY_PART_LABELS);

export type CustomExercise = {
	/** `custom-` prefixed — globally unique vs catalog ids ('0001'…'1324'). */
	id: string;
	name: string;
	bodyPart: string;
	equipment: string;
	createdAt: string;
};

export type CustomExerciseDraft = {
	name: string;
	bodyPart: string;
	equipment: string;
};

export function isCustomExerciseId(id: string): boolean {
	return id.startsWith(CUSTOM_EXERCISE_ID_PREFIX);
}

function clampName(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_EXERCISE_NAME_MAX);
}

function normalizeKey(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function knownOr(value: string, known: readonly string[], fallback: string): string {
	const key = normalizeKey(value);
	const hit = known.find((v) => normalizeKey(v) === key);
	return hit ?? fallback;
}

/** Validate + normalize free-form input. Null when name is unusable. */
export function normalizeCustomExercise(
	input: CustomExerciseDraft,
	now = new Date().toISOString()
): CustomExercise | null {
	const name = clampName(input.name);
	if (name.length < 2) return null;
	return {
		id: `${CUSTOM_EXERCISE_ID_PREFIX}${newId()}`,
		name,
		bodyPart: knownOr(input.bodyPart, BODY_PART_VALUES, 'upper arms'),
		equipment: knownOr(input.equipment, CUSTOM_EXERCISE_EQUIPMENT, 'body weight'),
		createdAt: now
	};
}

/** Same-visible-name guard (case/whitespace-insensitive). */
export function findDuplicateCustom(
	items: CustomExercise[],
	name: string,
	excludeId?: string
): CustomExercise | undefined {
	const key = normalizeKey(name);
	return items.find((ex) => ex.id !== excludeId && normalizeKey(ex.name) === key);
}

/** Defensive parse for untrusted localStorage / backup JSON. */
export function parseStoredCustomExercises(raw: unknown): CustomExercise[] {
	if (!Array.isArray(raw)) return [];
	const out: CustomExercise[] = [];
	const seen = new Set<string>();
	for (const value of raw) {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
		const v = value as Record<string, unknown>;
		if (typeof v.id !== 'string' || !isCustomExerciseId(v.id)) continue;
		if (typeof v.name !== 'string') continue;
		const name = clampName(v.name);
		if (!name || seen.has(v.id) || seen.has(normalizeKey(name))) continue;
		out.push({
			id: v.id,
			name,
			bodyPart: knownOr(String(v.bodyPart ?? ''), BODY_PART_VALUES, 'upper arms'),
			equipment: knownOr(String(v.equipment ?? ''), CUSTOM_EXERCISE_EQUIPMENT, 'body weight'),
			createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date(0).toISOString()
		});
		if (out.length >= MAX_CUSTOM_EXERCISES) break;
	}
	return out;
}

/** Shape used by every id→name Map consumer (live / builder / summary / history). */
export function customExerciseToIndexItem(ex: CustomExercise): ExerciseIndexItem {
	return {
		id: ex.id,
		name: ex.name,
		name_ru: ex.name,
		body_part: ex.bodyPart,
		equipment: ex.equipment,
		target: '',
		muscle_group: '',
		secondary_muscles: [],
		image: CUSTOM_EXERCISE_IMAGE
	};
}

function normalizeQuery(value: string): string {
	return value
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Substring word-prefix match — customs are few, fuzzy is overkill. */
export function filterCustomExercises(
	items: CustomExercise[],
	query: string,
	bodyParts?: Set<string>
): CustomExercise[] {
	const q = normalizeQuery(query);
	const zone = bodyParts && bodyParts.size > 0 ? bodyParts : null;
	return items.filter((ex) => {
		if (zone && !zone.has(ex.bodyPart)) return false;
		if (!q) return true;
		const name = normalizeQuery(ex.name);
		if (name.includes(q)) return true;
		const tokens = q.split(' ');
		return tokens.every((token) => name.split(' ').some((word) => word.startsWith(token)));
	});
}

/** Newest first; section views never paginate — cap keeps DOM small on weak phones. */
export function sortCustomsNewest(items: CustomExercise[], limit = MAX_CUSTOM_EXERCISES): CustomExercise[] {
	return [...items]
		.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
		.slice(0, limit);
}

/** Union on backup import; local wins on id collision, newer createdAt first. */
export function mergeCustomExercises(
	local: CustomExercise[],
	imported: CustomExercise[]
): CustomExercise[] {
	const byId = new Map<string, CustomExercise>();
	for (const ex of [...local, ...imported]) {
		if (!isCustomExerciseId(ex.id)) continue;
		byId.set(ex.id, ex);
	}
	return sortCustomsNewest([...byId.values()]);
}

export function labelEquipmentSafe(value: string): string {
	return EQUIPMENT_LABELS[value] ?? value;
}

export function runCustomExercisesSelfCheck(): void {
	const made = normalizeCustomExercise({
		name: '  Гоголь-   жим   стоя  ',
		bodyPart: 'Shoulders',
		equipment: 'dumbbells, plates'
	});
	if (!made) throw new Error('normalizeCustomExercise should accept a valid name');
	if (!isCustomExerciseId(made.id)) throw new Error('custom id must carry the prefix');
	if (made.name !== 'Гоголь- жим стоя') {
		throw new Error(`name collapse failed: ${made.name}`);
	}
	if (made.bodyPart !== 'shoulders') throw new Error(`bodyPart map failed: ${made.bodyPart}`);
	if (made.equipment !== 'body weight') throw new Error(`unknown equipment must fall back: ${made.equipment}`);

	if (normalizeCustomExercise({ name: ' а ', bodyPart: 'chest', equipment: 'cable' }) !== null) {
		throw new Error('name < 2 chars should be rejected');
	}
	if (findDuplicateCustom([made], 'гоголь-жим стоя')) {
		throw new Error('duplicate check should normalize case/whitespace');
	}
	if (findDuplicateCustom([made], 'гоголь-жим стоя', made.id)) {
		throw new Error('self id must not count as duplicate');
	}

	const stored = parseStoredCustomExercises([
		made,
		{ id: '0001', name: 'catalog id must be rejected' },
		{ id: 'custom-x', name: '  ' },
		{ id: 'custom-x2', name: 'Валик', bodyPart: 'nope', equipment: 'nope', createdAt: '2026-01-01T00:00:00.000Z' },
		'not-an-object'
	]);
	if (stored.length !== 2) throw new Error(`parseStored kept ${stored.length} of 2 valid`);
	if (stored[1] && stored[1].bodyPart !== 'upper arms') {
		throw new Error('unknown bodyPart must fall back');
	}

	const item = customExerciseToIndexItem(made);
	if (item.image !== CUSTOM_EXERCISE_IMAGE || item.target !== '') {
		throw new Error('index item shape drifted');
	}

	const a: CustomExercise = { ...made, id: 'custom-a', createdAt: '2026-01-02T00:00:00.000Z' };
	const b: CustomExercise = { ...made, id: 'custom-b', name: 'Второе', createdAt: '2026-01-01T00:00:00.000Z' };
	if (sortCustomsNewest([b, a])[0]?.id !== 'custom-a') {
		throw new Error('newest-first sort failed');
	}
	const merged = mergeCustomExercises([a], [{ ...a, name: 'Переименовано' }, b]);
	if (merged.length !== 2 || merged[0]?.name !== 'Переименовано') {
		throw new Error('merge by id failed');
	}

	const list = [
		{ ...made, bodyPart: 'shoulders' },
		{ ...b, name: 'Жим гантелей', bodyPart: 'chest' }
	];
	if (filterCustomExercises(list, 'жим ').length !== 2) {
		throw new Error('query match failed');
	}
	if (filterCustomExercises(list, '', new Set(['chest'])).length !== 1) {
		throw new Error('zone filter failed');
	}
	if (filterCustomExercises(list, 'жим гантелей плечи').length !== 0) {
		throw new Error('all-token match should reject partial hits');
	}
}
