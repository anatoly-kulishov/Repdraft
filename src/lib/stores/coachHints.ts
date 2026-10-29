import { browser } from '$app/environment';
import {
	COACH_HIDDEN_KEY,
	COACH_SEEN_KEY,
	hideCoachPart,
	isCoachPartHidden,
	parseCoachHidden,
	unhideCoachPart,
	type CoachHiddenMap
} from '$lib/domain/coachHints';
import { get, writable } from 'svelte/store';

function readHidden(): CoachHiddenMap {
	if (!browser) return {};
	try {
		return parseCoachHidden(localStorage.getItem(COACH_HIDDEN_KEY));
	} catch {
		return {};
	}
}

/** Hidden coach hints by body part (device-local, 7-day window). */
export const coachHidden = writable<CoachHiddenMap>(readHidden());

function persist(map: CoachHiddenMap): void {
	coachHidden.set(map);
	if (!browser) return;
	try {
		localStorage.setItem(COACH_HIDDEN_KEY, JSON.stringify(map));
	} catch {
		/* storage full / disabled */
	}
}

export function hideHint(bodyPart: string): void {
	persist(hideCoachPart(get(coachHidden), bodyPart));
}

export function unhideHint(bodyPart: string): void {
	persist(unhideCoachPart(get(coachHidden), bodyPart));
}

export function hintHidden(map: CoachHiddenMap, bodyPart: string): boolean {
	return isCoachPartHidden(map, bodyPart);
}

/** Epoch ms of the last visit to the coach screen (0 = never). */
export function readCoachSeenAt(): number {
	if (!browser) return 0;
	try {
		return Number(localStorage.getItem(COACH_SEEN_KEY)) || 0;
	} catch {
		return 0;
	}
}

export function markCoachSeen(): void {
	if (!browser) return;
	try {
		localStorage.setItem(COACH_SEEN_KEY, String(Date.now()));
	} catch {
		/* ignore */
	}
}
