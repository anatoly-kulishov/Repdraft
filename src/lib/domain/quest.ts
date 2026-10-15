/**
 * Phase B: thin Repdraft Quest rules (versioned).
 * XP for sticking to a chosen weekly plan - not tonnage or health claims.
 * Pure domain - persistence lives in stores/storage.
 */
import type { WorkoutSession } from './types';

/** Bump when XP / campaign rules change incompatibly. */
export const QUEST_RULES_VERSION = 1;

export const QUEST_ENABLED_STORAGE_KEY = 'repdraft:quest-enabled';
export const QUEST_STATE_STORAGE_KEY = 'repdraft:quest-state';

export const XP_PER_COUNTED_SESSION = 100;
export const XP_WEEKLY_GOAL_BONUS = 50;
export const DEFAULT_WEEKLY_GOAL = 2;
export const MIN_WEEKLY_GOAL = 1;
export const MAX_WEEKLY_GOAL = 7;
/** XP per hero level (cosmetic). */
export const XP_PER_LEVEL = 200;

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
};

export type QuestApplyResult = {
	state: QuestState;
	/** XP granted for this apply call (0 if duplicate / not countable). */
	xpGained: number;
	counted: boolean;
	goalJustMet: boolean;
	chapterAdvanced: boolean;
	campaignPaused: boolean;
};

export function parseQuestEnabled(raw: string | null | undefined): boolean {
	return raw === '1' || raw === 'true';
}

export function clampWeeklyGoal(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_WEEKLY_GOAL;
	return Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, Math.round(n)));
}

export function heroLevel(totalXp: number): number {
	const xp = Math.max(0, Math.floor(totalXp));
	return Math.floor(xp / XP_PER_LEVEL) + 1;
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
		rewardedSessionIds: []
	};
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
			goalMetAwarded:
				isObject(raw.week) && raw.week.goalMetAwarded === true
		},
		rewardedSessionIds
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
	let campaignPaused = false;
	if (campaign && campaign.status === 'active' && state.week.countedSessionIds.length === 0) {
		campaign = {
			...campaign,
			status: 'paused',
			pausedAt: now.toISOString()
		};
		campaignPaused = true;
	}
	void campaignPaused;
	return {
		...state,
		campaign,
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

/**
 * Award XP for a finished session. Idempotent per session id.
 * Extra sessions beyond weeklyGoal grant no XP.
 */
export function applyFinishedSessionToQuest(
	state: QuestState,
	session: WorkoutSession,
	now: Date = new Date()
): QuestApplyResult {
	let next = ensureQuestWeek(state, now);
	let campaignPaused = next.campaign?.status === 'paused' && state.campaign?.status === 'active';

	if (!isSessionCountableForQuest(session)) {
		return {
			state: next,
			xpGained: 0,
			counted: false,
			goalJustMet: false,
			chapterAdvanced: false,
			campaignPaused: Boolean(campaignPaused)
		};
	}

	if (next.rewardedSessionIds.includes(session.id)) {
		return {
			state: next,
			xpGained: 0,
			counted: false,
			goalJustMet: false,
			chapterAdvanced: false,
			campaignPaused: Boolean(campaignPaused)
		};
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
			campaignPaused: false
		};
	}

	let xpGained = XP_PER_COUNTED_SESSION;
	const countedIds = [...next.week.countedSessionIds, session.id];
	let goalMetAwarded = next.week.goalMetAwarded;
	let goalJustMet = false;
	if (!goalMetAwarded && countedIds.length >= next.weeklyGoal) {
		xpGained += XP_WEEKLY_GOAL_BONUS;
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
		campaignPaused: false
	};
}
