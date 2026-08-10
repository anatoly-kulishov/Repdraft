import { error } from '@sveltejs/kit';
import { isBodyPart, uniqueSorted } from '$lib/domain/filters';
import type { ExerciseIndexItem } from '$lib/domain/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch, url }) => {
	const bodyPart = decodeURIComponent(params.bodyPart);
	if (bodyPart !== 'all' && !isBodyPart(bodyPart)) {
		error(404, 'Not found');
	}

	const res = await fetch('/data/exercises.index.json');
	if (!res.ok) {
		return {
			bodyPart,
			initialQuery: url.searchParams.get('q') ?? '',
			bodyParts: [] as string[],
			equipment: [] as string[],
			targets: [] as string[],
			totalCount: 0,
			indexError: 'errors.catalogLoad'
		};
	}

	const exercises = (await res.json()) as ExerciseIndexItem[];
	return {
		bodyPart,
		initialQuery: url.searchParams.get('q') ?? '',
		bodyParts: uniqueSorted(exercises, 'body_part'),
		equipment: uniqueSorted(exercises, 'equipment'),
		targets: uniqueSorted(exercises, 'target'),
		totalCount: exercises.length,
		indexError: null as string | null
	};
};
