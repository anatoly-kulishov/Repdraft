import {
	catalogZoneBodyParts,
	hubCatalogZones,
	type CatalogZoneSlug
} from '$lib/domain/catalogLinks';
import { pickCatalogCoverImage, pickZoneCoverImage } from '$lib/domain/catalogCover';
import {
	equipmentCountsForZone,
	targetChipsForZoneBrowse,
	targetCountsForZone,
	uniqueSorted,
	type EquipmentChip,
	type TargetChip
} from '$lib/domain/filters';
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

function pickCoverImage(list: ExerciseIndexItem[], target?: string): string {
	return pickCatalogCoverImage(list, target);
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
		const image = pickCoverImage(list, target);
		if (image) covers[target] = image;
	}
	return covers;
}

function equipmentCoversForZone(
	exercises: ExerciseIndexItem[],
	bodyParts: string[]
): Record<string, string> {
	const inZone = exercises.filter((ex) => bodyParts.includes(ex.body_part));
	const byEquipment = new Map<string, ExerciseIndexItem[]>();
	for (const ex of inZone) {
		const eq = ex.equipment.trim();
		if (!eq) continue;
		const bucket = byEquipment.get(eq) ?? [];
		bucket.push(ex);
		byEquipment.set(eq, bucket);
	}
	const covers: Record<string, string> = {};
	for (const [equipment, list] of byEquipment) {
		const image = pickZoneCoverImage(list, equipment);
		if (image) covers[equipment] = image;
	}
	return covers;
}

function catalogHubMeta(exercises: ExerciseIndexItem[]) {
	const bodyParts = uniqueSorted(exercises, 'body_part');
	const zones = hubCatalogZones(bodyParts);
	const zoneCounts: Record<string, number> = {};
	const zoneCovers: Record<string, string> = {};
	for (const zone of zones) {
		const parts = catalogZoneBodyParts(zone);
		const inZone = exercises.filter((ex) => parts.includes(ex.body_part));
		zoneCounts[zone] = inZone.length;
		zoneCovers[zone] = pickZoneCoverImage(inZone, zone);
	}
	/** Hub grid: most exercises first (ties keep stable slug order). */
	const hubZones = [...zones].sort(
		(a, b) => (zoneCounts[b] ?? 0) - (zoneCounts[a] ?? 0) || a.localeCompare(b, 'en')
	);
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
	equipmentChips: EquipmentChip[];
	zoneCount: number;
	targetCovers: Record<string, string>;
	equipmentCovers: Record<string, string>;
	zoneCover: string;
};

const EMPTY_ZONE_EXTRA = {
	targetChips: [] as TargetChip[],
	equipmentChips: [] as EquipmentChip[],
	zoneCount: 0,
	targetCovers: {} as Record<string, string>,
	equipmentCovers: {} as Record<string, string>,
	zoneCover: ''
};

export async function loadCatalogZone(
	fetchFn: typeof fetch,
	bodyPart: string
): Promise<CatalogZonePayload> {
	const res = await fetchFn('/data/exercises.index.json');
	if (!res.ok) {
		return { ...EMPTY_INDEX, ...EMPTY_ZONE_EXTRA };
	}
	const exercises = (await res.json()) as ExerciseIndexItem[];
	const meta = catalogIndexMeta(exercises);
	const parts = catalogZoneBodyParts(bodyPart);
	if (bodyPart !== 'all' && parts.length === 0) {
		return { ...meta, ...EMPTY_ZONE_EXTRA };
	}
	if (bodyPart === 'all') {
		return {
			...meta,
			...EMPTY_ZONE_EXTRA,
			zoneCount: meta.totalCount
		};
	}
	const inZone = exercises.filter((ex) => parts.includes(ex.body_part));
	const targetChips = targetChipsForZoneBrowse(targetCountsForZone(exercises, parts), bodyPart);
	/** Equipment browse when the zone has no target subcategory grid. */
	const equipmentFacets = targetChips.length < 2;
	const equipmentChips = equipmentFacets ? equipmentCountsForZone(exercises, parts) : [];
	const zoneCount = inZone.length;
	const targetCovers = targetCoversForZone(exercises, parts);
	const equipmentCovers = equipmentFacets ? equipmentCoversForZone(exercises, parts) : {};
	/** «Все» must not reuse any visible target/equipment card plate. */
	const avoidZoneDup = new Set<string>();
	for (const chip of targetChips) {
		const cover = targetCovers[chip.target];
		if (cover) avoidZoneDup.add(cover);
	}
	for (const chip of equipmentChips) {
		const cover = equipmentCovers[chip.equipment];
		if (cover) avoidZoneDup.add(cover);
	}
	return {
		...meta,
		targetChips,
		equipmentChips,
		zoneCount,
		targetCovers,
		equipmentCovers,
		zoneCover: pickZoneCoverImage(inZone, bodyPart, avoidZoneDup)
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
