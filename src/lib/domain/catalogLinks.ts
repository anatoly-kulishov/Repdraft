import { isBodyPart } from './filters';
import type { BodyPart } from './types';

/** Primary catalog zone for a target muscle (by exercise count in index). */
const TARGET_PRIMARY_ZONE: Record<string, BodyPart> = {
	abs: 'waist',
	quads: 'upper legs',
	lats: 'back',
	calves: 'lower legs',
	pectorals: 'chest',
	glutes: 'upper legs',
	hamstrings: 'upper legs',
	adductors: 'upper legs',
	abductors: 'upper legs',
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

export function catalogZonePath(
	bodyPart: string,
	params?: { equipment?: string; target?: string; q?: string }
): string {
	const slug = encodeURIComponent(bodyPart);
	const search = new URLSearchParams();
	if (params?.q?.trim()) search.set('q', params.q.trim());
	if (params?.equipment) search.set('equipment', params.equipment);
	if (params?.target) search.set('target', params.target);
	const qs = search.toString();
	return qs ? `/catalog/${slug}?${qs}` : `/catalog/${slug}`;
}

export function catalogEquipmentPath(bodyPart: string, equipment: string): string {
	return catalogZonePath(bodyPart, { equipment });
}

export function catalogTargetPath(target: string, bodyPartHint?: string): string {
	const zone =
		bodyPartHint && isBodyPart(bodyPartHint) ? bodyPartHint : TARGET_PRIMARY_ZONE[target];
	return zone ? catalogZonePath(zone, { target }) : catalogZonePath('all', { target });
}
