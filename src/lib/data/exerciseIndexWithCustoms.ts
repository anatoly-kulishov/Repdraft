import { customExerciseToIndexItem } from '$lib/domain/customExercises';
import { peekLocalCustomExercises } from '$lib/storage/localCustomExerciseRepository';
import { loadExerciseIndex, peekExerciseIndex } from './loadExercises';
import type { ExerciseIndexItem } from '$lib/domain/types';

/**
 * id→name maps for builder / live / summary / history must resolve local
 * exercises too. Catalog browsing (facets, hub counts) never uses this.
 */
export function withCustomExercises(items: ExerciseIndexItem[]): ExerciseIndexItem[] {
	const customs = peekLocalCustomExercises().map(customExerciseToIndexItem);
	return customs.length > 0 ? [...items, ...customs] : items;
}

export async function loadExerciseIndexWithCustoms(
	fetchFn: typeof fetch = fetch
): Promise<ExerciseIndexItem[]> {
	return withCustomExercises(await loadExerciseIndex(fetchFn));
}

export function peekExerciseIndexWithCustoms(): ExerciseIndexItem[] | null {
	const cached = peekExerciseIndex();
	return cached ? withCustomExercises(cached) : null;
}
