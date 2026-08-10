import { uniqueSorted } from '$lib/domain/filters';
import type { ExerciseIndexItem } from '$lib/domain/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/data/exercises.index.json');
	if (!res.ok) {
		return {
			bodyParts: [] as string[],
			equipment: [] as string[],
			targets: [] as string[],
			totalCount: 0,
			indexError: 'errors.catalogLoad'
		};
	}

	const exercises = (await res.json()) as ExerciseIndexItem[];
	return {
		bodyParts: uniqueSorted(exercises, 'body_part'),
		equipment: uniqueSorted(exercises, 'equipment'),
		targets: uniqueSorted(exercises, 'target'),
		totalCount: exercises.length,
		indexError: null as string | null
	};
};
