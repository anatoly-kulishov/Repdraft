/**
 * Opt-in workout achievements (thin, versioned).
 * Pure domain - no streaks, loot, or paid XP.
 */
import type { WorkoutSession } from './types';

export const ACHIEVEMENTS_RULES_VERSION = 1;
export const ACHIEVEMENTS_ENABLED_STORAGE_KEY = 'repdraft:achievements-enabled';
export const ACHIEVEMENTS_STATE_STORAGE_KEY = 'repdraft:achievements-state';

export type AchievementId =
	| 'first_session'
	| 'sessions_5'
	| 'sessions_25'
	| 'weekly_goal'
	| 'first_pr';

export type AchievementUnlock = {
	id: AchievementId;
	unlockedAt: string;
	sourceSessionId?: string;
};

export type AchievementsState = {
	rulesVersion: number;
	unlocked: AchievementUnlock[];
};

export type AchievementEvalInput = {
	state: AchievementsState;
	/** Finished sessions including `justFinished` if already saved. */
	finishedSessions: WorkoutSession[];
	justFinished: WorkoutSession;
	questGoalJustMet: boolean;
	/** New personal records written from this session. */
	newPrCount: number;
	now?: Date;
};

export type AchievementEvalResult = {
	state: AchievementsState;
	newlyUnlocked: AchievementId[];
};

export const ACHIEVEMENT_IDS: readonly AchievementId[] = [
	'first_session',
	'sessions_5',
	'sessions_25',
	'weekly_goal',
	'first_pr'
] as const;

export function parseAchievementsEnabled(raw: string | null | undefined): boolean {
	return raw === '1' || raw === 'true';
}

export function createInitialAchievementsState(): AchievementsState {
	return {
		rulesVersion: ACHIEVEMENTS_RULES_VERSION,
		unlocked: []
	};
}

function isAchievementId(v: unknown): v is AchievementId {
	return typeof v === 'string' && (ACHIEVEMENT_IDS as readonly string[]).includes(v);
}

export function parseAchievementsState(raw: unknown): AchievementsState {
	const fallback = createInitialAchievementsState();
	if (!raw || typeof raw !== 'object') return fallback;
	const o = raw as Record<string, unknown>;
	const unlockedRaw = Array.isArray(o.unlocked) ? o.unlocked : [];
	const unlocked: AchievementUnlock[] = [];
	for (const item of unlockedRaw) {
		if (!item || typeof item !== 'object') continue;
		const u = item as Record<string, unknown>;
		if (!isAchievementId(u.id)) continue;
		if (typeof u.unlockedAt !== 'string' || !u.unlockedAt) continue;
		unlocked.push({
			id: u.id,
			unlockedAt: u.unlockedAt,
			sourceSessionId: typeof u.sourceSessionId === 'string' ? u.sourceSessionId : undefined
		});
	}
	return {
		rulesVersion: ACHIEVEMENTS_RULES_VERSION,
		unlocked
	};
}

export function isUnlocked(state: AchievementsState, id: AchievementId): boolean {
	return state.unlocked.some((u) => u.id === id);
}

function unlock(
	state: AchievementsState,
	id: AchievementId,
	now: Date,
	sessionId: string,
	newly: AchievementId[]
): AchievementsState {
	if (isUnlocked(state, id)) return state;
	newly.push(id);
	return {
		...state,
		unlocked: [
			...state.unlocked,
			{ id, unlockedAt: now.toISOString(), sourceSessionId: sessionId }
		]
	};
}

/** Count finished sessions with at least one completed set. */
export function countableFinishedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
	return sessions.filter(
		(s) =>
			Boolean(s.finishedAt) &&
			s.exercises.some((ex) => ex.sets.some((set) => set.completed))
	);
}

/**
 * Evaluate unlocks after a finished session.
 * Idempotent: already-unlocked ids are never re-added.
 */
export function evaluateAchievements(input: AchievementEvalInput): AchievementEvalResult {
	const now = input.now ?? new Date();
	const newlyUnlocked: AchievementId[] = [];
	let state = input.state;
	const sessionId = input.justFinished.id;
	const finished = countableFinishedSessions(input.finishedSessions);
	const count = finished.length;

	if (count >= 1) {
		state = unlock(state, 'first_session', now, sessionId, newlyUnlocked);
	}
	if (count >= 5) {
		state = unlock(state, 'sessions_5', now, sessionId, newlyUnlocked);
	}
	if (count >= 25) {
		state = unlock(state, 'sessions_25', now, sessionId, newlyUnlocked);
	}
	if (input.questGoalJustMet) {
		state = unlock(state, 'weekly_goal', now, sessionId, newlyUnlocked);
	}
	if (input.newPrCount > 0) {
		state = unlock(state, 'first_pr', now, sessionId, newlyUnlocked);
	}

	return { state, newlyUnlocked };
}

export function achievementTitleKey(id: AchievementId): string {
	switch (id) {
		case 'first_session':
			return 'achievements.firstSession';
		case 'sessions_5':
			return 'achievements.sessions5';
		case 'sessions_25':
			return 'achievements.sessions25';
		case 'weekly_goal':
			return 'achievements.weeklyGoal';
		case 'first_pr':
			return 'achievements.firstPr';
		default: {
			const _exhaustive: never = id;
			return _exhaustive;
		}
	}
}

export type AchievementCategory = 'all' | 'routine' | 'quest' | 'records';

export function achievementCategory(id: AchievementId): AchievementCategory {
	switch (id) {
		case 'first_session':
		case 'sessions_5':
		case 'sessions_25':
			return 'routine';
		case 'weekly_goal':
			return 'quest';
		case 'first_pr':
			return 'records';
		default: {
			const _exhaustive: never = id;
			return _exhaustive;
		}
	}
}

export type AchievementProgress = {
	id: AchievementId;
	current: number;
	target: number;
	unlocked: boolean;
};

export function achievementProgressList(
	state: AchievementsState,
	finishedSessions: WorkoutSession[]
): AchievementProgress[] {
	const count = countableFinishedSessions(finishedSessions).length;
	return ACHIEVEMENT_IDS.map((id) => {
		const unlocked = isUnlocked(state, id);
		switch (id) {
			case 'first_session':
				return { id, current: Math.min(count, 1), target: 1, unlocked };
			case 'sessions_5':
				return { id, current: Math.min(count, 5), target: 5, unlocked };
			case 'sessions_25':
				return { id, current: Math.min(count, 25), target: 25, unlocked };
			case 'weekly_goal':
				return { id, current: unlocked ? 1 : 0, target: 1, unlocked };
			case 'first_pr':
				return { id, current: unlocked ? 1 : 0, target: 1, unlocked };
			default: {
				const _exhaustive: never = id;
				return _exhaustive;
			}
		}
	});
}

export function achievementHintKey(id: AchievementId): string {
	switch (id) {
		case 'first_session':
			return 'achievements.firstSessionHint';
		case 'sessions_5':
			return 'achievements.sessions5Hint';
		case 'sessions_25':
			return 'achievements.sessions25Hint';
		case 'weekly_goal':
			return 'achievements.weeklyGoalHint';
		case 'first_pr':
			return 'achievements.firstPrHint';
		default: {
			const _exhaustive: never = id;
			return _exhaustive;
		}
	}
}

// Self-check (ponytail): fails loudly if unlock / parse regress.
{
	const empty = createInitialAchievementsState();
	const session: WorkoutSession = {
		id: 's1',
		planId: 'p1',
		planName: 'A',
		startedAt: '2026-01-01T10:00:00.000Z',
		finishedAt: '2026-01-01T11:00:00.000Z',
		exercises: [
			{
				exerciseId: 'e1',
				targetSets: 1,
				targetReps: 5,
				restSec: 90,
				sets: [{ weightKg: 60, reps: 5, completed: true }]
			}
		]
	};
	const first = evaluateAchievements({
		state: empty,
		finishedSessions: [session],
		justFinished: session,
		questGoalJustMet: false,
		newPrCount: 0
	});
	if (!first.newlyUnlocked.includes('first_session')) {
		throw new Error('achievements: first_session should unlock');
	}
	const again = evaluateAchievements({
		state: first.state,
		finishedSessions: [session],
		justFinished: session,
		questGoalJustMet: false,
		newPrCount: 0
	});
	if (again.newlyUnlocked.length !== 0) {
		throw new Error('achievements: unlock must be idempotent');
	}
	const parsed = parseAchievementsState(first.state);
	if (!isUnlocked(parsed, 'first_session')) {
		throw new Error('achievements: parse round-trip failed');
	}
}
