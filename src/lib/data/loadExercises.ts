import type { ExerciseIndexItem } from '$lib/domain/types';

let indexPromise: Promise<ExerciseIndexItem[]> | null = null;
let cachedIndex: ExerciseIndexItem[] | null = null;

/** Catalog metadata only (~380KB). Full payloads load on demand via `loadExerciseCatalog`. */
export function loadExerciseIndex(): Promise<ExerciseIndexItem[]> {
	if (!indexPromise) {
		indexPromise = fetch('/data/exercises.index.json')
			.then(async (res) => {
				if (!res.ok) {
					throw new Error('errors.catalogLoad');
				}
				const data = (await res.json()) as ExerciseIndexItem[];
				cachedIndex = data.map((ex) => ({
					...ex,
					globalPopularity:
						typeof ex.globalPopularity === 'number' && Number.isFinite(ex.globalPopularity)
							? Math.min(100, Math.max(1, ex.globalPopularity))
							: 25
				}));
				return cachedIndex;
			})
			.catch((err) => {
				indexPromise = null;
				throw err;
			});
	}
	return indexPromise;
}

/** Warm-nav: non-null when catalog was already fetched this session. */
export function peekExerciseIndex(): ExerciseIndexItem[] | null {
	return cachedIndex;
}

export async function getIndexItemById(id: string): Promise<ExerciseIndexItem | null> {
	const index = await loadExerciseIndex();
	return index.find((item) => item.id === id) ?? null;
}
