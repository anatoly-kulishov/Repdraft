import { uniqueSorted } from '$lib/domain/filters';
import type { ExerciseIndexItem } from '$lib/domain/types';

export type CatalogIndexPayload = {
	bodyParts: string[];
	equipment: string[];
	targets: string[];
	totalCount: number;
	indexError: string | null;
};

export type CatalogHubPayload = CatalogIndexPayload & {
	zoneCounts: Record<string, number>;
	zoneCovers: Record<string, string>;
};

function catalogHubMeta(exercises: ExerciseIndexItem[]) {
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
	return { zoneCounts, zoneCovers };
}

function catalogIndexMeta(exercises: ExerciseIndexItem[]): CatalogIndexPayload {
	return {
		bodyParts: uniqueSorted(exercises, 'body_part'),
		equipment: uniqueSorted(exercises, 'equipment'),
		targets: uniqueSorted(exercises, 'target'),
		totalCount: exercises.length,
		indexError: null
	};
}

const EMPTY_INDEX: CatalogIndexPayload = {
	bodyParts: [],
	equipment: [],
	targets: [],
	totalCount: 0,
	indexError: 'errors.catalogLoad'
};

export async function loadCatalogIndex(fetchFn: typeof fetch): Promise<CatalogIndexPayload> {
	const res = await fetchFn('/data/exercises.index.json');
	if (!res.ok) return { ...EMPTY_INDEX };
	const exercises = (await res.json()) as ExerciseIndexItem[];
	return catalogIndexMeta(exercises);
}

export async function loadCatalogHub(fetchFn: typeof fetch): Promise<CatalogHubPayload> {
	const res = await fetchFn('/data/exercises.index.json');
	if (!res.ok) {
		return { ...EMPTY_INDEX, zoneCounts: {}, zoneCovers: {} };
	}
	const exercises = (await res.json()) as ExerciseIndexItem[];
	const meta = catalogIndexMeta(exercises);
	const hub = catalogHubMeta(exercises);
	return { ...meta, ...hub };
}
