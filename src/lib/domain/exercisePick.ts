/**
 * Builder quick-pick: filter the catalog by the kit and the muscles the athlete
 * actually has, without knowing exercise names. Shared by the web wizard and
 * (later) any client that wants the same rules; the catalog shape is the only
 * input, so this stays a pure function.
 */

import type { ExerciseIndexItem } from './types';

export type ExercisePickFilters = {
	/** Raw catalog `equipment` values; empty means «any». */
	equipment?: readonly string[] | null;
	/** Raw catalog `body_part` values; empty means «whole body». */
	bodyParts?: readonly string[] | null;
};

export type EquipmentFacet = { equipment: string; count: number };

const BODYWEIGHT = new Set(['body weight', 'bodyweight']);

/** Bodyweight always counts as available: no gym required for a fallback. */
export function exerciseMatchesEquipment(
	exercise: Pick<ExerciseIndexItem, 'equipment'>,
	equipment: readonly string[] | null | undefined
): boolean {
	if (!equipment || equipment.length === 0) return true;
	const value = exercise.equipment.trim().toLowerCase();
	if (BODYWEIGHT.has(value)) return true;
	return equipment.some((item) => item.trim().toLowerCase() === value);
}

/**
 * Everything that matches the kit and at least one chosen muscle, most popular
 * first: a beginner recognises the staples, not the long tail.
 */
export function pickExercisesForKit(
	catalog: readonly ExerciseIndexItem[],
	filters: ExercisePickFilters = {}
): ExerciseIndexItem[] {
	const bodyParts = (filters.bodyParts ?? []).filter((part) => part.trim().length > 0);
	const rows = catalog.filter(
		(exercise) =>
			(bodyParts.length === 0 || bodyParts.includes(exercise.body_part)) &&
			exerciseMatchesEquipment(exercise, filters.equipment)
	);
	return rows.sort((a, b) => {
		const diff = (b.globalPopularity ?? 0) - (a.globalPopularity ?? 0);
		return diff !== 0 ? diff : a.id.localeCompare(b.id);
	});
}

/**
 * Equipment chips for the first wizard step: bodyweight pinned first, then the
 * most stocked kinds, so the list stays scannable on a phone.
 */
export function equipmentFacets(
	catalog: readonly ExerciseIndexItem[],
	limit = 9
): EquipmentFacet[] {
	const counts = new Map<string, number>();
	for (const exercise of catalog) {
		const key = exercise.equipment.trim();
		if (!key) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([equipment, count]) => ({ equipment, count }))
		.sort((a, b) => {
			const bodyweightA = BODYWEIGHT.has(a.equipment.toLowerCase()) ? 1 : 0;
			const bodyweightB = BODYWEIGHT.has(b.equipment.toLowerCase()) ? 1 : 0;
			if (bodyweightA !== bodyweightB) return bodyweightB - bodyweightA;
			if (a.count !== b.count) return b.count - a.count;
			return a.equipment.localeCompare(b.equipment);
		})
		.slice(0, Math.max(1, limit));
}

export function runExercisePickSelfCheck(): void {
	const base = {
		muscle_group: '',
		secondary_muscles: [],
		image: '',
		name: 'x'
	};
	const catalog: ExerciseIndexItem[] = [
		{ ...base, id: 'a', body_part: 'chest', equipment: 'barbell', target: 'pectorals', globalPopularity: 90 },
		{ ...base, id: 'b', body_part: 'chest', equipment: 'dumbbell', target: 'pectorals', globalPopularity: 70 },
		{ ...base, id: 'c', body_part: 'chest', equipment: 'body weight', target: 'pectorals', globalPopularity: 50 },
		{ ...base, id: 'd', body_part: 'back', equipment: 'barbell', target: 'lats', globalPopularity: 95 },
		{ ...base, id: 'e', body_part: 'back', equipment: 'cable', target: 'lats', globalPopularity: 80 }
	];

	const dumbbells = pickExercisesForKit(catalog, { equipment: ['dumbbell'] });
	if (dumbbells.map((row) => row.id).join(',') !== 'b,c') {
		throw new Error(`exercisePick: dumbbell + bodyweight, got ${dumbbells.map((row) => row.id)}`);
	}

	const chest = pickExercisesForKit(catalog, { bodyParts: ['chest'] });
	if (chest.map((row) => row.id).join(',') !== 'a,b,c') {
		throw new Error('exercisePick: body part filter must keep popularity order');
	}

	const all = pickExercisesForKit(catalog);
	if (all[0]?.id !== 'd') throw new Error('exercisePick: no filters must sort by popularity');

	const facets = equipmentFacets(catalog, 3);
	if (facets[0]?.equipment !== 'body weight') {
		throw new Error('exercisePick: bodyweight facet must lead');
	}
	if (facets.some((facet) => facet.count < 1)) throw new Error('exercisePick: empty facet');
}
