import { isBodyPart } from './filters';
import { labelBodyPart } from './labels.ru';
import type { AppLocale } from '$lib/i18n/locale';
import type { BodyPart } from './types';

/** Hub + catalog slug that spans multiple dataset body_part values. */
export const VIRTUAL_CATALOG_ZONES: Record<string, readonly BodyPart[]> = {
	legs: ['upper legs', 'lower legs']
};

export type CatalogZoneSlug = BodyPart | keyof typeof VIRTUAL_CATALOG_ZONES;

const HUB_ZONE_ORDER: CatalogZoneSlug[] = [
	'back',
	'chest',
	'legs',
	'shoulders',
	'upper arms',
	'waist',
	'lower arms',
	'cardio',
	'neck'
];

/** Primary catalog zone for a target muscle (by exercise count in index). */
const TARGET_PRIMARY_ZONE: Record<string, CatalogZoneSlug> = {
	abs: 'waist',
	quads: 'legs',
	lats: 'back',
	calves: 'legs',
	pectorals: 'chest',
	glutes: 'legs',
	hamstrings: 'legs',
	adductors: 'legs',
	abductors: 'legs',
	triceps: 'upper arms',
	'cardiovascular system': 'cardio',
	spine: 'back',
	'upper back': 'back',
	biceps: 'upper arms',
	delts: 'shoulders',
	forearms: 'lower arms',
	traps: 'back',
	'serratus anterior': 'chest',
	'levator scapulae': 'neck'
};

export function isCatalogZone(value: string): value is CatalogZoneSlug {
	return isBodyPart(value) || value in VIRTUAL_CATALOG_ZONES;
}

export function catalogZoneBodyParts(slug: string): string[] {
	if (slug in VIRTUAL_CATALOG_ZONES) return [...VIRTUAL_CATALOG_ZONES[slug]];
	if (isBodyPart(slug)) return [slug];
	return [];
}

export function labelCatalogZone(slug: string, locale: AppLocale = 'ru'): string {
	if (slug === 'legs') return locale === 'ru' ? 'Ноги' : 'Legs';
	return labelBodyPart(slug, locale);
}

/** Hub cards: merge upper/lower legs into one «Ноги» entry. */
export function hubCatalogZones(bodyParts: string[]): CatalogZoneSlug[] {
	const set = new Set(bodyParts);
	const hasLegs = set.has('upper legs') || set.has('lower legs');
	return HUB_ZONE_ORDER.filter((zone) => {
		if (zone === 'legs') return hasLegs;
		return set.has(zone);
	});
}

export function catalogZonePath(
	bodyPart: string,
	params?: { equipment?: string; target?: string; q?: string; browse?: string }
): string {
	const slug = encodeURIComponent(bodyPart);
	const search = new URLSearchParams();
	if (params?.q?.trim()) search.set('q', params.q.trim());
	if (params?.equipment) search.set('equipment', params.equipment);
	if (params?.target) search.set('target', params.target);
	if (params?.browse) search.set('browse', params.browse);
	const qs = search.toString();
	return qs ? `/catalog/${slug}?${qs}` : `/catalog/${slug}`;
}

export function catalogEquipmentPath(bodyPart: string, equipment: string): string {
	return catalogZonePath(bodyPart, { equipment });
}

export function catalogTargetPath(target: string, bodyPartHint?: string): string {
	const zone =
		bodyPartHint && isCatalogZone(bodyPartHint)
			? bodyPartHint
			: (TARGET_PRIMARY_ZONE[target] ?? null);
	return zone ? catalogZonePath(zone, { target }) : catalogZonePath('all', { target });
}

/** Constructor «add exercise» opens the catalog hub (zones), not a flat list. */
export const BUILDER_ADD_EXERCISE_HREF = '/exercises?from=%2Fbuilder';

/** Start a blank draft (clears leftover name/exercises from a previous edit). */
export const BUILDER_NEW_HREF = '/builder?new=1';

export const WORKOUTS_HREF = '/workouts';
export const WORKOUTS_HISTORY_HREF = '/workouts?tab=history';

export function isBuilderReturnPath(from: string | null | undefined): boolean {
	return from === '/builder' || Boolean(from?.startsWith('/builder?'));
}

/** Append `?from=` / `&from=` so builder → hub → zone keeps a return path. */
export function withFromParam(href: string, from: string | null | undefined): string {
	const value = from?.trim();
	if (!value) return href;
	const sep = href.includes('?') ? '&' : '?';
	return `${href}${sep}from=${encodeURIComponent(value)}`;
}
