import { uniqueSorted } from '$lib/domain/filters';
import type { ExerciseIndexItem } from '$lib/domain/types';
import type { PageLoad } from './$types';

const BOOT_SIZE = 24;

/**
 * First paint: only a boot page of cards (img URLs in HTML → early LCP).
 * Full index still loads on the client for search/filters.
 */
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/data/exercises.index.json');
	if (!res.ok) {
		return {
			boot: [] as ExerciseIndexItem[],
			bodyParts: [] as string[],
			equipment: [] as string[],
			targets: [] as string[],
			totalCount: 0,
			indexError: 'errors.catalogLoad'
		};
	}

	const exercises = (await res.json()) as ExerciseIndexItem[];
	return {
		boot: exercises.slice(0, BOOT_SIZE),
		bodyParts: uniqueSorted(exercises, 'body_part'),
		equipment: uniqueSorted(exercises, 'equipment'),
		targets: uniqueSorted(exercises, 'target'),
		totalCount: exercises.length,
		indexError: null as string | null
	};
};
