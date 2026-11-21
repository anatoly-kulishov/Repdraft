/**
 * One vocabulary for muscle groups.
 *
 * The dataset splits legs into `upper legs` and `lower legs`. The catalog hub,
 * the progress shares, the session summary and the coach hints all speak zones,
 * so calves are a part of «Ноги» and never a rival group that wins a "lagging"
 * badge just by being small. Pure data + helpers: no catalog, no UI, no filters,
 * so cheap-to-import domain modules (trainingLoad, progressOverview) stay light.
 */
import type { BodyPart } from './types';

/** Hub + catalog slug that spans several dataset body_part values. */
export const VIRTUAL_CATALOG_ZONES: Record<string, readonly BodyPart[]> = {
	legs: ['upper legs', 'lower legs']
};

/** Dataset body parts behind a zone slug. A plain body part maps to itself. */
export function zoneBodyParts(value: string): string[] {
	if (value in VIRTUAL_CATALOG_ZONES) return [...VIRTUAL_CATALOG_ZONES[value]];
	return [value];
}

/** Dataset body_part -> the zone the app speaks. */
export function catalogZoneForBodyPart(bodyPart: string): string {
	for (const slug of Object.keys(VIRTUAL_CATALOG_ZONES)) {
		if (VIRTUAL_CATALOG_ZONES[slug].includes(bodyPart as BodyPart)) return slug;
	}
	return bodyPart;
}
