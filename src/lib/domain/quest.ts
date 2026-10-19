/**
 * Phase B: thin Repdraft Quest rules (versioned).
 * XP for sticking to a chosen weekly plan - not tonnage or health claims.
 * Pure domain - persistence lives in stores/storage.
 */
import { exerciseBestWeightKg } from './sessionStats';
import type { WorkoutSession } from './types';

/** Bump when XP / campaign rules change incompatibly. */
export const QUEST_RULES_VERSION = 2;

export const QUEST_STATE_STORAGE_KEY = 'repdraft:quest-state';

export const XP_PER_COUNTED_SESSION = 100;
export const XP_WEEKLY_GOAL_BONUS = 50;
export const DEFAULT_WEEKLY_GOAL = 2;
export const MIN_WEEKLY_GOAL = 1;
export const MAX_WEEKLY_GOAL = 7;
/** XP per hero level (cosmetic). */
export const XP_PER_LEVEL = 200;
/** Extra XP when this session's working weight beats the previous one. */
export const XP_WEIGHT_UP = 10;
export const XP_WEIGHT_UP_CAP = 3;
/** Applied to base + weight-up XP from the second consecutive active week. */
export const STREAK_BONUS_RATE = 0.1;

export const STARTER_CAMPAIGN_ID = 'starter-campaign';
export const STARTER_CAMPAIGN_CHAPTERS = 4;

export type QuestCampaignStatus = 'active' | 'paused' | 'completed';

export type QuestHero = {
	totalXp: number;
};

export type QuestCampaign = {
	id: string;
	chapterIndex: number;
	status: QuestCampaignStatus;
	startedAt: string;
	pausedAt: string | null;
};

export type QuestWeek = {
	/** Local Monday day key YYYY-MM-DD. */
	weekKey: string;
	countedSessionIds: string[];
	xpEarned: number;
	goalMetAwarded: boolean;
};

export type QuestState = {
	rulesVersion: number;
	weeklyGoal: number;
	hero: QuestHero;
	campaign: QuestCampaign | null;
	week: QuestWeek;
	/** Session ids already rewarded (cross-week idempotency). */
	rewardedSessionIds: string[];
	/** Consecutive weeks that already have a counted session, including the current one. */
	streakWeeks: number;
	/** Monday key of the last week that earned a counted session. */
	lastActiveWeekKey: string | null;
	/** A full week was missed. Cleared on the next counted session. Banked XP stays. */
	streakBroken: boolean;
};

export type QuestXpBreakdown = {
	base: number;
	weightUp: number;
	weightUpCount: number;
	streakBonus: number;
	weeklyGoal: number;
};

export type QuestApplyResult = {
	state: QuestState;
	/** XP granted for this apply call (0 if duplicate / not countable). */
	xpGained: number;
	counted: boolean;
	goalJustMet: boolean;
	chapterAdvanced: boolean;
	campaignPaused: boolean;
	breakdown: QuestXpBreakdown;
};

export function clampWeeklyGoal(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_WEEKLY_GOAL;
	return Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, Math.round(n)));
}

export function heroLevel(totalXp: number): number {
	const xp = Math.max(0, Math.floor(totalXp));
	return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export type HeroXpProgress = {
	level: number;
	xpInLevel: number;
	xpForLevel: number;
};

export function heroXpProgress(totalXp: number): HeroXpProgress {
	const xp = Math.max(0, Math.floor(totalXp));
	const level = heroLevel(xp);
	const xpInLevel = xp - (level - 1) * XP_PER_LEVEL;
	return { level, xpInLevel, xpForLevel: XP_PER_LEVEL };
}

export type QuestDailyHint =
	| { key: 'quest.dailyRaise'; vars: { name: string } }
	| { key: 'quest.dailyWeekly'; vars: { n: number } }
	| { key: 'quest.dailyCampaign' }
	| { key: 'quest.dailySession'; vars: { xp: number } };

/** One-line home hint. `raiseName` wins when the last session has a loaded lift. */
export function questDailyHint(state: QuestState, raiseName?: string | null): QuestDailyHint {
	const name = raiseName?.trim();
	if (name) return { key: 'quest.dailyRaise', vars: { name } };
	const done = state.week.countedSessionIds.length;
	const remaining = state.weeklyGoal - done;
	if (remaining > 0) {
		return { key: 'quest.dailyWeekly', vars: { n: remaining } };
	}
	if (state.campaign?.status === 'active') {
		return { key: 'quest.dailyCampaign' };
	}
	return { key: 'quest.dailySession', vars: { xp: XP_PER_COUNTED_SESSION } };
}

export function weekKeyFromDate(d: Date): string {
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
	const y = monday.getFullYear();
	const m = String(monday.getMonth() + 1).padStart(2, '0');
	const dayNum = String(monday.getDate()).padStart(2, '0');
	return `${y}-${m}-${dayNum}`;
}

export function emptyQuestWeek(weekKey: string): QuestWeek {
	return {
		weekKey,
		countedSessionIds: [],
		xpEarned: 0,
		goalMetAwarded: false
	};
}

export function createInitialQuestState(now: Date = new Date()): QuestState {
	return {
		rulesVersion: QUEST_RULES_VERSION,
		weeklyGoal: DEFAULT_WEEKLY_GOAL,
		hero: { totalXp: 0 },
		campaign: null,
		week: emptyQuestWeek(weekKeyFromDate(now)),
		rewardedSessionIds: [],
		streakWeeks: 0,
		lastActiveWeekKey: null,
		streakBroken: false
	};
}

export function emptyQuestBreakdown(): QuestXpBreakdown {
	return { base: 0, weightUp: 0, weightUpCount: 0, streakBonus: 0, weeklyGoal: 0 };
}

function weekIndex(weekKey: string): number | null {
	const t = Date.parse(`${weekKey}T00:00:00`);
	if (!Number.isFinite(t)) return null;
	return Math.round(t / (7 * 86_400_000));
}

/** How many Monday-weeks `newer` is after `older`. */
export function weeksBetweenKeys(older: string, newer: string): number | null {
	const a = weekIndex(older);
	const b = weekIndex(newer);
	if (a == null || b == null) return null;
	return b - a;
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v != null && !Array.isArray(v);
}

export function parseQuestState(raw: unknown, now: Date = new Date()): QuestState {
	const fallback = createInitialQuestState(now);
	if (!isObject(raw)) return fallback;
	const weeklyGoal = clampWeeklyGoal(
		typeof raw.weeklyGoal === 'number' ? raw.weeklyGoal : DEFAULT_WEEKLY_GOAL
	);
	const heroXp =
		isObject(raw.hero) && typeof raw.hero.totalXp === 'number' ? raw.hero.totalXp : 0;
	let campaign: QuestCampaign | null = null;
	if (isObject(raw.campaign)) {
		const status = raw.campaign.status;
		if (
			(status === 'active' || status === 'paused' || status === 'completed') &&
			typeof raw.campaign.id === 'string' &&
			typeof raw.campaign.chapterIndex === 'number' &&
			typeof raw.campaign.startedAt === 'string'
		) {
			campaign = {
				id: raw.campaign.id,
				chapterIndex: Math.max(0, Math.floor(raw.campaign.chapterIndex)),
				status,
				startedAt: raw.campaign.startedAt,
				pausedAt: typeof raw.campaign.pausedAt === 'string' ? raw.campaign.pausedAt : null
			};
		}
	}
	const weekKey =
		isObject(raw.week) && typeof raw.week.weekKey === 'string'
			? raw.week.weekKey
			: weekKeyFromDate(now);
	const countedSessionIds =
		isObject(raw.week) && Array.isArray(raw.week.countedSessionIds)
			? raw.week.countedSessionIds.filter((id): id is string => typeof id === 'string')
			: [];
	const rewardedSessionIds = Array.isArray(raw.rewardedSessionIds)
		? raw.rewardedSessionIds.filter((id): id is string => typeof id === 'string')
		: [];
	const streakWeeks =
		typeof raw.streakWeeks === 'number' && Number.isFinite(raw.streakWeeks)
			? Math.max(0, Math.floor(raw.streakWeeks))
			: 0;
	const lastActiveWeekKey =
		typeof raw.lastActiveWeekKey === 'string' && raw.lastActiveWeekKey ? raw.lastActiveWeekKey : null;
	return {
		rulesVersion: QUEST_RULES_VERSION,
		weeklyGoal,
		hero: { totalXp: Math.max(0, Math.floor(heroXp)) },
		campaign,
		week: {
			weekKey,
			countedSessionIds,
			xpEarned:
				isObject(raw.week) && typeof raw.week.xpEarned === 'number'
					? Math.max(0, Math.floor(raw.week.xpEarned))
					: 0,
			goalMetAwarded: isObject(raw.week) && raw.week.goalMetAwarded === true
		},
		rewardedSessionIds,
		streakWeeks,
		lastActiveWeekKey,
		streakBroken: raw.streakBroken === true
	};
}

/** At least one completed set and a finish stamp. */
export function isSessionCountableForQuest(session: WorkoutSession): boolean {
	if (!session.finishedAt) return false;
	return session.exercises.some((ex) => ex.sets.some((s) => s.completed));
}

export function ensureQuestWeek(state: QuestState, now: Date): QuestState {
	const key = weekKeyFromDate(now);
	if (state.week.weekKey === key) return state;
	let campaign = state.campaign;
	if (campaign && campaign.status === 'active' && state.week.countedSessionIds.length === 0) {
		campaign = {
			...campaign,
			status: 'paused',
			pausedAt: now.toISOString()
		};
	}
	const gap = weeksBetweenKeys(state.week.weekKey, key);
	const oldHadSessions = state.week.countedSessionIds.length > 0;
	const missed = gap == null || gap > 1 || !oldHadSessions;
	const hadStreak = state.streakWeeks > 0 || state.lastActiveWeekKey != null;
	let streakWeeks = state.streakWeeks;
	let lastActiveWeekKey = state.lastActiveWeekKey;
	let streakBroken = state.streakBroken;
	if (missed && hadStreak) {
		streakWeeks = 0;
		lastActiveWeekKey = null;
		streakBroken = true;
	}
	return {
		...state,
		campaign,
		streakWeeks,
		lastActiveWeekKey,
		streakBroken,
		week: emptyQuestWeek(key)
	};
}

export function startStarterCampaign(state: QuestState, now: Date = new Date()): QuestState {
	if (state.campaign?.status === 'active' || state.campaign?.status === 'completed') {
		return state;
	}
	return {
		...state,
		campaign: {
			id: STARTER_CAMPAIGN_ID,
			chapterIndex: 0,
			status: 'active',
			startedAt: now.toISOString(),
			pausedAt: null
		}
	};
}

export function resumeCampaign(state: QuestState): QuestState {
	if (!state.campaign || state.campaign.status !== 'paused') return state;
	return {
		...state,
		campaign: { ...state.campaign, status: 'active', pausedAt: null }
	};
}

export function setWeeklyGoal(state: QuestState, goal: number): QuestState {
	return { ...state, weeklyGoal: clampWeeklyGoal(goal) };
}

/** Exercises whose working weight beat the previous finished session, capped. */
export function weightUpExerciseIds(
	session: WorkoutSession,
	prior: readonly WorkoutSession[]
): string[] {
	const previous = prior
		.filter((s) => s.id !== session.id && s.finishedAt)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
	const seen = new Set<string>();
	const ups: string[] = [];
	for (const ex of session.exercises) {
		if (seen.has(ex.exerciseId)) continue;
		seen.add(ex.exerciseId);
		const nowW = exerciseBestWeightKg(session, ex.exerciseId);
		if (nowW == null) continue;
		const prev = previous.find((s) => exerciseBestWeightKg(s, ex.exerciseId) != null);
		if (!prev) continue;
		const prevW = exerciseBestWeightKg(prev, ex.exerciseId);
		if (prevW != null && nowW > prevW) ups.push(ex.exerciseId);
		if (ups.length >= XP_WEIGHT_UP_CAP) break;
	}
	return ups;
}

function bumpStreak(state: QuestState, weekKey: string): Pick<
	QuestState,
	'streakWeeks' | 'lastActiveWeekKey' | 'streakBroken'
> {
	if (state.lastActiveWeekKey === weekKey) {
		return {
			streakWeeks: Math.max(1, state.streakWeeks),
			lastActiveWeekKey: weekKey,
			streakBroken: false
		};
	}
	const gap = state.lastActiveWeekKey
		? weeksBetweenKeys(state.lastActiveWeekKey, weekKey)
		: null;
	const streakWeeks = gap === 1 && state.streakWeeks > 0 ? state.streakWeeks + 1 : 1;
	return { streakWeeks, lastActiveWeekKey: weekKey, streakBroken: false };
}

/**
 * Award XP for a finished session. Idempotent per session id.
 * Extra sessions beyond weeklyGoal grant no XP.
 */
export function applyFinishedSessionToQuest(
	state: QuestState,
	session: WorkoutSession,
	now: Date = new Date(),
	prior: readonly WorkoutSession[] = []
): QuestApplyResult {
	let next = ensureQuestWeek(state, now);
	const campaignPaused = next.campaign?.status === 'paused' && state.campaign?.status === 'active';
	const idle = {
		xpGained: 0,
		counted: false,
		goalJustMet: false,
		chapterAdvanced: false,
		campaignPaused: Boolean(campaignPaused),
		breakdown: emptyQuestBreakdown()
	};

	if (!isSessionCountableForQuest(session)) {
		return { state: next, ...idle };
	}

	if (next.rewardedSessionIds.includes(session.id)) {
		return { state: next, ...idle, campaignPaused: Boolean(campaignPaused) };
	}

	if (next.campaign?.status === 'paused') {
		next = resumeCampaign(next);
	}
	if (!next.campaign) {
		next = startStarterCampaign(next, now);
	}

	const underGoal = next.week.countedSessionIds.length < next.weeklyGoal;
	if (!underGoal) {
		return {
			state: {
				...next,
				rewardedSessionIds: [...next.rewardedSessionIds, session.id]
			},
			xpGained: 0,
			counted: false,
			goalJustMet: false,
			chapterAdvanced: false,
			campaignPaused: false,
			breakdown: emptyQuestBreakdown()
		};
	}

	const streak = bumpStreak(next, next.week.weekKey);
	next = { ...next, ...streak };
	const weightIds = weightUpExerciseIds(session, prior);
	const base = XP_PER_COUNTED_SESSION;
	const weightUp = weightIds.length * XP_WEIGHT_UP;
	const streakBonus =
		next.streakWeeks >= 2 ? Math.round((base + weightUp) * STREAK_BONUS_RATE) : 0;
	let xpGained = base + weightUp + streakBonus;
	let weeklyGoalXp = 0;
	const countedIds = [...next.week.countedSessionIds, session.id];
	let goalMetAwarded = next.week.goalMetAwarded;
	let goalJustMet = false;
	if (!goalMetAwarded && countedIds.length >= next.weeklyGoal) {
		weeklyGoalXp = XP_WEEKLY_GOAL_BONUS;
		xpGained += weeklyGoalXp;
		goalMetAwarded = true;
		goalJustMet = true;
	}

	let campaign = next.campaign;
	let chapterAdvanced = false;
	if (campaign && campaign.status === 'active' && goalJustMet) {
		const nextChapter = campaign.chapterIndex + 1;
		if (nextChapter >= STARTER_CAMPAIGN_CHAPTERS) {
			campaign = {
				...campaign,
				chapterIndex: STARTER_CAMPAIGN_CHAPTERS - 1,
				status: 'completed',
				pausedAt: null
			};
			chapterAdvanced = true;
		} else {
			campaign = { ...campaign, chapterIndex: nextChapter, pausedAt: null };
			chapterAdvanced = true;
		}
	}

	const totalXp = next.hero.totalXp + xpGained;
	return {
		state: {
			...next,
			hero: { totalXp },
			campaign,
			week: {
				weekKey: next.week.weekKey,
				countedSessionIds: countedIds,
				xpEarned: next.week.xpEarned + xpGained,
				goalMetAwarded
			},
			rewardedSessionIds: [...next.rewardedSessionIds, session.id]
		},
		xpGained,
		counted: true,
		goalJustMet,
		chapterAdvanced,
		campaignPaused: false,
		breakdown: {
			base,
			weightUp,
			weightUpCount: weightIds.length,
			streakBonus,
			weeklyGoal: weeklyGoalXp
		}
	};
}
