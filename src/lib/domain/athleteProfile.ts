/**
 * Local athlete intake profile (first-run stepper + profile edit).
 * Feeds catalog place default and AI brief. Not synced to cloud in MVP.
 */

import { HOME_EQUIPMENT_FILTER } from './homeKit';

export const ATHLETE_PROFILE_STORAGE_KEY = 'repdraft:athlete-profile';

export type TrainingPlace = 'gym' | 'home';

export type AthleteGoalId =
	| 'strength'
	| 'muscle'
	| 'cut'
	| 'endurance'
	| 'habit';

export type AthleteExperience = 'new' | 'returning' | 'regular';

export type AthleteLimitId = 'knees' | 'shoulders' | 'back' | 'none';

export type AthleteProfile = {
	trainingPlace: TrainingPlace;
	goals: AthleteGoalId[];
	heightCm: number | null;
	weightKg: number | null;
	experience: AthleteExperience | null;
	daysPerWeek: number | null;
	sessionMinutes: number | null;
	limits: AthleteLimitId[];
	/** ISO timestamp when intake finished or skipped; null = show stepper. */
	intakeCompletedAt: string | null;
};

export const ATHLETE_GOAL_IDS = [
	'strength',
	'muscle',
	'cut',
	'endurance',
	'habit'
] as const satisfies readonly AthleteGoalId[];

export const ATHLETE_LIMIT_IDS = [
	'knees',
	'shoulders',
	'back',
	'none'
] as const satisfies readonly AthleteLimitId[];

export const ATHLETE_EXPERIENCE_IDS = [
	'new',
	'returning',
	'regular'
] as const satisfies readonly AthleteExperience[];

export const ATHLETE_DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
export const ATHLETE_SESSION_MINUTES_OPTIONS = [30, 45, 60, 75, 90] as const;

export type IntakeStepId = 'goals' | 'place' | 'kit' | 'body' | 'rhythm' | 'limits';

/** Step order depends on place (kit only for home). */
export function intakeStepsForPlace(place: TrainingPlace): readonly IntakeStepId[] {
	if (place === 'home') {
		return ['goals', 'place', 'kit', 'body', 'rhythm', 'limits'];
	}
	return ['goals', 'place', 'body', 'rhythm', 'limits'];
}

const GOAL_SET = new Set<string>(ATHLETE_GOAL_IDS);
const LIMIT_SET = new Set<string>(ATHLETE_LIMIT_IDS);
const EXP_SET = new Set<string>(ATHLETE_EXPERIENCE_IDS);

export function defaultAthleteProfile(): AthleteProfile {
	return {
		trainingPlace: 'gym',
		goals: [],
		heightCm: null,
		weightKg: null,
		experience: null,
		daysPerWeek: null,
		sessionMinutes: null,
		limits: [],
		intakeCompletedAt: null
	};
}

export function isTrainingPlace(value: string): value is TrainingPlace {
	return value === 'gym' || value === 'home';
}

export function isAthleteGoalId(value: string): value is AthleteGoalId {
	return GOAL_SET.has(value);
}

export function isAthleteLimitId(value: string): value is AthleteLimitId {
	return LIMIT_SET.has(value);
}

export function isAthleteExperience(value: string): value is AthleteExperience {
	return EXP_SET.has(value);
}

export function needsIntakeStepper(profile: AthleteProfile): boolean {
	return profile.intakeCompletedAt == null;
}

/** Catalog equipment URL/filter default from place. */
export function catalogEquipmentForPlace(place: TrainingPlace): 'all' | typeof HOME_EQUIPMENT_FILTER {
	return place === 'home' ? HOME_EQUIPMENT_FILTER : 'all';
}

function clampInt(value: unknown, min: number, max: number): number | null {
	if (value == null || value === '') return null;
	const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
	if (!Number.isFinite(n)) return null;
	const rounded = Math.round(n);
	if (rounded < min || rounded > max) return null;
	return rounded;
}

function normalizeGoals(raw: unknown): AthleteGoalId[] {
	if (!Array.isArray(raw)) return [];
	const out: AthleteGoalId[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const id = String(item);
		if (!isAthleteGoalId(id) || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function normalizeLimits(raw: unknown): AthleteLimitId[] {
	if (!Array.isArray(raw)) return [];
	const out: AthleteLimitId[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const id = String(item);
		if (!isAthleteLimitId(id) || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	if (out.includes('none') && out.length > 1) {
		return ['none'];
	}
	return out;
}

export function normalizeAthleteProfile(raw: unknown): AthleteProfile {
	const base = defaultAthleteProfile();
	if (!raw || typeof raw !== 'object') return base;
	const v = raw as Record<string, unknown>;
	const place = typeof v.trainingPlace === 'string' && isTrainingPlace(v.trainingPlace)
		? v.trainingPlace
		: base.trainingPlace;
	const experience =
		typeof v.experience === 'string' && isAthleteExperience(v.experience)
			? v.experience
			: null;
	const days = clampInt(v.daysPerWeek, 1, 7);
	const minutes = clampInt(v.sessionMinutes, 15, 180);
	const heightCm = clampInt(v.heightCm, 100, 250);
	const weightKg = clampInt(v.weightKg, 30, 300);
	const completed =
		typeof v.intakeCompletedAt === 'string' && v.intakeCompletedAt.trim()
			? v.intakeCompletedAt.trim()
			: null;
	return {
		trainingPlace: place,
		goals: normalizeGoals(v.goals),
		heightCm,
		weightKg,
		experience,
		daysPerWeek: days,
		sessionMinutes: minutes,
		limits: normalizeLimits(v.limits),
		intakeCompletedAt: completed
	};
}

export function parseAthleteProfileStorage(raw: string | null | undefined): AthleteProfile {
	if (raw == null || raw === '') return defaultAthleteProfile();
	try {
		return normalizeAthleteProfile(JSON.parse(raw) as unknown);
	} catch {
		return defaultAthleteProfile();
	}
}

export function serializeAthleteProfileStorage(profile: AthleteProfile): string {
	return JSON.stringify(normalizeAthleteProfile(profile));
}

export function markIntakeComplete(profile: AthleteProfile, at = new Date().toISOString()): AthleteProfile {
	return normalizeAthleteProfile({ ...profile, intakeCompletedAt: at });
}

export function skipIntakeProfile(at = new Date().toISOString()): AthleteProfile {
	return markIntakeComplete(defaultAthleteProfile(), at);
}

export function toggleAthleteGoal(
	goals: readonly AthleteGoalId[],
	id: AthleteGoalId
): AthleteGoalId[] {
	return goals.includes(id) ? goals.filter((g) => g !== id) : [...goals, id];
}

export function toggleAthleteLimit(
	limits: readonly AthleteLimitId[],
	id: AthleteLimitId
): AthleteLimitId[] {
	if (id === 'none') return ['none'];
	const withoutNone = limits.filter((l) => l !== 'none');
	return withoutNone.includes(id)
		? withoutNone.filter((l) => l !== id)
		: [...withoutNone, id];
}

const GOAL_BRIEF_RU: Record<AthleteGoalId, string> = {
	strength: 'сила',
	muscle: 'масса',
	cut: 'рельеф',
	endurance: 'выносливость',
	habit: 'привычка тренироваться'
};

const GOAL_BRIEF_EN: Record<AthleteGoalId, string> = {
	strength: 'strength',
	muscle: 'muscle gain',
	cut: 'fat loss',
	endurance: 'endurance',
	habit: 'training habit'
};

const EXP_BRIEF_RU: Record<AthleteExperience, string> = {
	new: 'новичок',
	returning: 'возврат после перерыва',
	regular: 'уже тренируется регулярно'
};

const EXP_BRIEF_EN: Record<AthleteExperience, string> = {
	new: 'beginner',
	returning: 'returning after a break',
	regular: 'trains regularly'
};

const LIMIT_BRIEF_RU: Record<Exclude<AthleteLimitId, 'none'>, string> = {
	knees: 'беречь колени',
	shoulders: 'беречь плечи',
	back: 'беречь спину'
};

const LIMIT_BRIEF_EN: Record<Exclude<AthleteLimitId, 'none'>, string> = {
	knees: 'protect knees',
	shoulders: 'protect shoulders',
	back: 'protect back'
};

/** Gym-plain clauses for AI brief. Empty profile adds nothing. */
export function appendAthleteProfileToBrief(
	brief: string,
	profile: AthleteProfile,
	locale: 'ru' | 'en' = 'ru'
): string {
	const parts: string[] = [];
	const ru = locale === 'ru';

	if (profile.goals.length > 0) {
		const labels = profile.goals.map((g) => (ru ? GOAL_BRIEF_RU[g] : GOAL_BRIEF_EN[g]));
		parts.push(ru ? `цель: ${labels.join(', ')}` : `goal: ${labels.join(', ')}`);
	}

	parts.push(
		ru
			? profile.trainingPlace === 'home'
				? 'место: дома'
				: 'место: зал'
			: profile.trainingPlace === 'home'
				? 'place: home'
				: 'place: gym'
	);

	if (profile.experience) {
		parts.push(ru ? EXP_BRIEF_RU[profile.experience] : EXP_BRIEF_EN[profile.experience]);
	}

	if (profile.daysPerWeek != null) {
		parts.push(
			ru ? `${profile.daysPerWeek} дн/нед` : `${profile.daysPerWeek} days/week`
		);
	}

	if (profile.sessionMinutes != null) {
		parts.push(
			ru ? `сессия ~${profile.sessionMinutes} мин` : `session ~${profile.sessionMinutes} min`
		);
	}

	if (profile.heightCm != null) {
		parts.push(ru ? `рост ${profile.heightCm} см` : `height ${profile.heightCm} cm`);
	}
	if (profile.weightKg != null) {
		parts.push(ru ? `вес ${profile.weightKg} кг` : `weight ${profile.weightKg} kg`);
	}

	const activeLimits = profile.limits.filter((l): l is Exclude<AthleteLimitId, 'none'> => l !== 'none');
	if (activeLimits.length > 0) {
		const labels = activeLimits.map((l) => (ru ? LIMIT_BRIEF_RU[l] : LIMIT_BRIEF_EN[l]));
		parts.push(labels.join(', '));
	}

	if (parts.length === 0) return brief.trim();
	const clause = parts.join(', ');
	const trimmed = brief.trim();
	if (!trimmed) return clause;
	const lower = trimmed.toLowerCase();
	if (parts.some((p) => lower.includes(p.toLowerCase()))) return trimmed;
	return `${trimmed}, ${clause}`;
}

export function runAthleteProfileSelfCheck(): void {
	const raw = parseAthleteProfileStorage(
		serializeAthleteProfileStorage({
			...defaultAthleteProfile(),
			trainingPlace: 'home',
			goals: ['strength', 'strength', 'nope' as AthleteGoalId],
			heightCm: 180,
			weightKg: 80,
			experience: 'regular',
			daysPerWeek: 3,
			sessionMinutes: 45,
			limits: ['knees', 'none'],
			intakeCompletedAt: null
		})
	);
	if (raw.trainingPlace !== 'home') throw new Error('place');
	if (raw.goals.join() !== 'strength') throw new Error(`goals ${raw.goals.join()}`);
	if (raw.limits.join() !== 'none') throw new Error('limits none wins');
	if (needsIntakeStepper(raw) !== true) throw new Error('needs intake');
	const done = markIntakeComplete(raw);
	if (needsIntakeStepper(done)) throw new Error('completed');
	if (catalogEquipmentForPlace('home') !== 'home') throw new Error('catalog home');
	if (catalogEquipmentForPlace('gym') !== 'all') throw new Error('catalog gym');
	const baseBrief = appendAthleteProfileToBrief('верх', done, 'ru');
	if (!baseBrief.includes('цель: сила') || !baseBrief.includes('место: дома')) {
		throw new Error(`brief base ${baseBrief}`);
	}
	if (baseBrief.includes('беречь колени')) throw new Error('none limit must not add knees');
	const withKnees = appendAthleteProfileToBrief(
		'верх',
		{ ...done, limits: ['knees'] },
		'ru'
	);
	if (!withKnees.includes('беречь колени') || !withKnees.includes('цель: сила')) {
		throw new Error(`brief ${withKnees}`);
	}
	if (toggleAthleteLimit(['knees'], 'none').join() !== 'none') throw new Error('toggle none');
	if (toggleAthleteGoal(['strength'], 'muscle').join() !== 'strength,muscle') {
		throw new Error('toggle goal');
	}
	const skipped = skipIntakeProfile('2026-01-01T00:00:00.000Z');
	if (skipped.intakeCompletedAt !== '2026-01-01T00:00:00.000Z') throw new Error('skip');
	if (skipped.trainingPlace !== 'gym') throw new Error('skip defaults gym');
}
