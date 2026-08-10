import { uniqueSorted } from '$lib/domain/filters';
import type { ExerciseIndexItem } from '$lib/domain/types';
import type { PageLoad } from './$types';

function catalogMeta(exercises: ExerciseIndexItem[]) {
	const zoneCounts: Record<string, number> = {};
	const byPart = new Map<string, ExerciseIndexItem[]>();
	for (const ex of exercises) {
		zoneCounts[ex.body_part] = (zoneCounts[ex.body_part] ?? 0) + 1;
		const bucket = byPart.get(ex.body_part) ?? [];
		bucket.push(ex);
		byPart.set(ex.body_part, bucket);
	}
	const zoneCovers: Record<string, string> = {};
	for (const [part, list] of byPart) {
		list.sort((a, b) => a.id.localeCompare(b.id));
		const pick = list[Math.floor(list.length / 2)] ?? list[0];
		if (pick) zoneCovers[part] = pick.image;
	}
	return {
		bodyParts: uniqueSorted(exercises, 'body_part'),
		zoneCounts,
		zoneCovers,
		totalCount: exercises.length
	};
}

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/data/exercises.index.json');
	if (!res.ok) {
		return {
			bodyParts: [] as string[],
			zoneCounts: {} as Record<string, number>,
			zoneCovers: {} as Record<string, string>,
			totalCount: 0,
			indexError: 'errors.catalogLoad'
		};
	}

	const exercises = (await res.json()) as ExerciseIndexItem[];
	const meta = catalogMeta(exercises);
	return {
		...meta,
		indexError: null as string | null
	};
};
