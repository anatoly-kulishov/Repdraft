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

/** Name, sex, height, and weight for Quest home stats (not required to start a workout). */
export function isHeroReady(profile: QuestHeroProfile | null): profile is QuestHeroProfile {
	if (!profile?.completedAt) return false;
	if (!profile.displayName.trim()) return false;
	if (profile.sex !== 'm' && profile.sex !== 'f') return false;
	if (profile.heightCm == null || profile.weightKg == null) return false;
	return true;
}

function onboardFieldText(raw: string | number | null | undefined): string {
	return String(raw ?? '').trim();
}

/** Onboarding height field: 100-250 cm, digits only (no silent clamp while typing). */
export function parseOnboardHeightCm(raw: string | number | null | undefined): number | null {
	const t = onboardFieldText(raw);
	if (!t || !/^\d+$/.test(t)) return null;
	const n = parseInt(t, 10);
	if (!Number.isFinite(n) || n < 100 || n > 250) return null;
	return n;
}

/** Onboarding weight field: 30-300 kg; comma or dot decimal. */
export function parseOnboardWeightKg(raw: string | number | null | undefined): number | null {
	const t = onboardFieldText(raw).replace(',', '.');
	if (!t || !/^\d+(\.\d{0,2})?$/.test(t)) return null;
	const n = parseFloat(t);
	if (!Number.isFinite(n) || n < 30 || n > 300) return null;
	return Math.round(n * 10) / 10;
}

export function isQuestOnboardingReady(input: {
	displayName: string;
	sex: QuestHeroSex | null;
	heightRaw: string | number | null | undefined;
	weightRaw: string | number | null | undefined;
}): boolean {
	if (!input.displayName.trim()) return false;
	if (input.sex !== 'm' && input.sex !== 'f') return false;
	if (parseOnboardHeightCm(input.heightRaw) == null) return false;
	if (parseOnboardWeightKg(input.weightRaw) == null) return false;
	return true;
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
