import { browser } from '$app/environment';
import {
	QUEST_HERO_PROFILE_KEY,
	isHeroReady,
	parseQuestHeroProfile,
	type QuestHeroProfile
} from '$lib/domain/questHeroProfile';

function readRaw(): unknown {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(QUEST_HERO_PROFILE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

export function loadQuestHeroProfile(): QuestHeroProfile | null {
	return parseQuestHeroProfile(readRaw());
}

export function saveQuestHeroProfile(profile: QuestHeroProfile): void {
	if (!browser) return;
	try {
		localStorage.setItem(QUEST_HERO_PROFILE_KEY, JSON.stringify(profile));
	} catch {
		/* ignore */
	}
}

export function needsQuestHeroOnboarding(): boolean {
	return !isHeroReady(loadQuestHeroProfile());
}
