import {
	QUEST_HERO_PROFILE_KEY,
	isHeroReady,
	parseQuestHeroProfile,
	type QuestHeroProfile
} from '@repdraft/domain/questHeroProfile';
import { kvGetJson, kvSetJson } from '../storage/kv';

export async function loadQuestHeroProfile(): Promise<QuestHeroProfile | null> {
	const raw = await kvGetJson<unknown>(QUEST_HERO_PROFILE_KEY, null);
	return parseQuestHeroProfile(raw);
}

export async function saveQuestHeroProfile(profile: QuestHeroProfile): Promise<void> {
	await kvSetJson(QUEST_HERO_PROFILE_KEY, profile);
}

export async function needsQuestHeroOnboarding(): Promise<boolean> {
	return !isHeroReady(await loadQuestHeroProfile());
}
