export const QUEST_HERO_PROFILE_KEY = 'repdraft:quest-hero-profile';

export type QuestHeroSex = 'm' | 'f';

export type QuestHeroProfile = {
	displayName: string;
	sex: QuestHeroSex | null;
	age: number | null;
	heightCm: number | null;
	weightKg: number | null;
	completedAt: string;
};

export function isQuestHeroOnboarded(raw: unknown): boolean {
	const p = parseQuestHeroProfile(raw);
	return Boolean(p?.completedAt);
}

export function parseQuestHeroProfile(raw: unknown): QuestHeroProfile | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (typeof o.completedAt !== 'string' || !o.completedAt) return null;
	const displayName = typeof o.displayName === 'string' ? o.displayName.trim() : '';
	const sex = o.sex === 'm' || o.sex === 'f' ? o.sex : null;
	const age = typeof o.age === 'number' && Number.isFinite(o.age) ? Math.round(o.age) : null;
	const heightCm =
		typeof o.heightCm === 'number' && Number.isFinite(o.heightCm)
			? Math.round(o.heightCm)
			: null;
	const weightKg =
		typeof o.weightKg === 'number' && Number.isFinite(o.weightKg)
			? Math.round(o.weightKg * 10) / 10
			: null;
	return {
		displayName,
		sex,
		age,
		heightCm,
		weightKg,
		completedAt: o.completedAt
	};
}
