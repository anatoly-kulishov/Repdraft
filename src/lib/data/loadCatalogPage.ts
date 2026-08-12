import {
	catalogZoneBodyParts,
	hubCatalogZones,
	type CatalogZoneSlug
} from '$lib/domain/catalogLinks';
import { targetCountsForZone, uniqueSorted, type TargetChip } from '$lib/domain/filters';
import type { ExerciseIndexItem } from '$lib/domain/types';

export type CatalogIndexPayload = {
	bodyParts: string[];
	equipment: string[];
	targets: string[];
	totalCount: number;
	indexError: string | null;
};

export type CatalogHubPayload = CatalogIndexPayload & {
	hubZones: CatalogZoneSlug[];
	zoneCounts: Record<string, number>;
	zoneCovers: Record<string, string>;
};

function pickCoverImage(list: ExerciseIndexItem[]): string {
	if (!list.length) return '';
	const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
	const pick = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
	return pick?.image ?? '';
}

function targetCoversForZone(
	exercises: ExerciseIndexItem[],
	bodyParts: string[]
): Record<string, string> {
	const inZone = exercises.filter((ex) => bodyParts.includes(ex.body_part));
	const byTarget = new Map<string, ExerciseIndexItem[]>();
	for (const ex of inZone) {
		const bucket = byTarget.get(ex.target) ?? [];
		bucket.push(ex);
		byTarget.set(ex.target, bucket);
	}
	const covers: Record<string, string> = {};
	for (const [target, list] of byTarget) {
		const image = pickCoverImage(list);
		if (image) covers[target] = image;
	}
	return covers;
}

function catalogHubMeta(exercises: ExerciseIndexItem[]) {
	const rawCounts: Record<string, number> = {};
	const byPart = new Map<string, ExerciseIndexItem[]>();
	for (const ex of exercises) {
		rawCounts[ex.body_part] = (rawCounts[ex.body_part] ?? 0) + 1;
		const bucket = byPart.get(ex.body_part) ?? [];
		bucket.push(ex);
		byPart.set(ex.body_part, bucket);
	}
	const rawCovers: Record<string, string> = {};
	for (const [part, list] of byPart) {
		const image = pickCoverImage(list);
		if (image) rawCovers[part] = image;
	}

	const bodyParts = uniqueSorted(exercises, 'body_part');
	const hubZones = hubCatalogZones(bodyParts);
	const zoneCounts: Record<string, number> = {};
	const zoneCovers: Record<string, string> = {};
	for (const zone of hubZones) {
		const parts = catalogZoneBodyParts(zone);
		zoneCounts[zone] = parts.reduce((sum, part) => sum + (rawCounts[part] ?? 0), 0);
		zoneCovers[zone] =
			rawCovers[parts[0] ?? ''] ?? rawCovers[parts[1] ?? ''] ?? Object.values(rawCovers)[0] ?? '';
	}
	return { zoneCounts, zoneCovers, hubZones };
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

export type CatalogZonePayload = CatalogIndexPayload & {
	targetChips: TargetChip[];
	zoneCount: number;
	targetCovers: Record<string, string>;
	zoneCover: string;
};

export async function loadCatalogZone(
	fetchFn: typeof fetch,
	bodyPart: string
): Promise<CatalogZonePayload> {
	const res = await fetchFn('/data/exercises.index.json');
	if (!res.ok) {
		return { ...EMPTY_INDEX, targetChips: [], zoneCount: 0, targetCovers: {}, zoneCover: '' };
	}
	const exercises = (await res.json()) as ExerciseIndexItem[];
	const meta = catalogIndexMeta(exercises);
	const parts = catalogZoneBodyParts(bodyPart);
	if (bodyPart !== 'all' && parts.length === 0) {
		return { ...meta, targetChips: [], zoneCount: 0, targetCovers: {}, zoneCover: '' };
	}
	if (bodyPart === 'all') {
		return {
			...meta,
			targetChips: [],
			zoneCount: meta.totalCount,
			targetCovers: {},
			zoneCover: ''
		};
	}
	const inZone = exercises.filter((ex) => parts.includes(ex.body_part));
	const targetChips = targetCountsForZone(exercises, parts);
	const zoneCount = inZone.length;
	return {
		...meta,
		targetChips,
		zoneCount,
		targetCovers: targetCoversForZone(exercises, parts),
		zoneCover: pickCoverImage(inZone)
	};
}

export async function loadCatalogIndex(fetchFn: typeof fetch): Promise<CatalogIndexPayload> {
	const res = await fetchFn('/data/exercises.index.json');
	if (!res.ok) return { ...EMPTY_INDEX };
	const exercises = (await res.json()) as ExerciseIndexItem[];
	return catalogIndexMeta(exercises);
}

export async function loadCatalogHub(fetchFn: typeof fetch): Promise<CatalogHubPayload> {
	const res = await fetchFn('/data/exercises.index.json');
	if (!res.ok) {
		return { ...EMPTY_INDEX, hubZones: [], zoneCounts: {}, zoneCovers: {} };
	}
	const exercises = (await res.json()) as ExerciseIndexItem[];
	const meta = catalogIndexMeta(exercises);
	const hub = catalogHubMeta(exercises);
	return { ...meta, ...hub };
}
