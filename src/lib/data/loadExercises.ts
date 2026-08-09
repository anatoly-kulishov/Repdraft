import type { ExerciseIndexItem } from '$lib/domain/types';

let indexPromise: Promise<ExerciseIndexItem[]> | null = null;

/** Catalog metadata only (~380KB). Full exercise payloads stay on the server. */
export function loadExerciseIndex(): Promise<ExerciseIndexItem[]> {
	if (!indexPromise) {
		indexPromise = fetch('/data/exercises.index.json')
			.then(async (res) => {
				if (!res.ok) {
					throw new Error('errors.catalogLoad');
				}
				return (await res.json()) as ExerciseIndexItem[];
			})
			.catch((err) => {
				indexPromise = null;
				throw err;
			});
	}
	return indexPromise;
}

export async function getIndexItemById(id: string): Promise<ExerciseIndexItem | null> {
	const index = await loadExerciseIndex();
	return index.find((item) => item.id === id) ?? null;
}
