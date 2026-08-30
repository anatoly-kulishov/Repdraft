import type { Exercise } from '$lib/domain/types';

const FULL_CATALOG_URL = '/data/exercises.full.json';

let byId: Map<string, Exercise> | null = null;
let loadPromise: Promise<Map<string, Exercise>> | null = null;

/** Full catalog (~15MB static JSON). Cached in memory; SW precaches for offline PWA. */
async function catalog(fetchFn: typeof fetch): Promise<Map<string, Exercise>> {
	if (byId) return byId;
	if (!loadPromise) {
		loadPromise = fetchFn(FULL_CATALOG_URL)
			.then(async (res) => {
				if (!res.ok) {
					throw new Error(`exercise catalog load failed (${res.status})`);
				}
				const list = (await res.json()) as Exercise[];
				byId = new Map(list.map((ex) => [ex.id, ex]));
				return byId;
			})
			.catch((err) => {
				loadPromise = null;
				throw err;
			});
	}
	return loadPromise;
}

export async function getExerciseById(
	id: string,
	fetchFn: typeof fetch = fetch
): Promise<Exercise | null> {
	const map = await catalog(fetchFn);
	return map.get(id) ?? null;
}
