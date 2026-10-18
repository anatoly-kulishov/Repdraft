import {
	ACHIEVEMENTS_ENABLED_STORAGE_KEY,
	ACHIEVEMENTS_STATE_STORAGE_KEY,
	createInitialAchievementsState,
	evaluateAchievements,
	parseAchievementsEnabled,
	parseAchievementsState,
	type AchievementEvalResult,
	type AchievementId,
	type AchievementsState
} from '@repdraft/domain/achievements';
import type { WorkoutSession } from '@repdraft/domain/types';
import { kvGet, kvGetJson, kvSet, kvSetJson } from '../storage/kv';

const LAST_UNLOCK_KEY = 'repdraft:achievements-last-unlock';

export type LastAchievementUnlock = {
	sessionId: string;
	ids: AchievementId[];
};

export async function isAchievementsEnabled(): Promise<boolean> {
	return parseAchievementsEnabled(await kvGet(ACHIEVEMENTS_ENABLED_STORAGE_KEY));
}

export async function setAchievementsEnabled(on: boolean): Promise<void> {
	await kvSet(ACHIEVEMENTS_ENABLED_STORAGE_KEY, on ? '1' : '0');
}

export async function loadAchievementsState(): Promise<AchievementsState> {
	const raw = await kvGetJson<unknown>(ACHIEVEMENTS_STATE_STORAGE_KEY, null);
	return parseAchievementsState(raw ?? createInitialAchievementsState());
}

export async function saveAchievementsState(state: AchievementsState): Promise<void> {
	await kvSetJson(ACHIEVEMENTS_STATE_STORAGE_KEY, state);
}

export async function loadLastAchievementUnlock(
	sessionId: string
): Promise<AchievementId[] | null> {
	const raw = await kvGetJson<LastAchievementUnlock | null>(LAST_UNLOCK_KEY, null);
	if (!raw || raw.sessionId !== sessionId || !Array.isArray(raw.ids) || raw.ids.length === 0) {
		return null;
	}
	return raw.ids;
}

export async function noteFinishedSessionAchievements(opts: {
	justFinished: WorkoutSession;
	finishedSessions: WorkoutSession[];
	questGoalJustMet: boolean;
	newPrCount: number;
}): Promise<AchievementEvalResult | null> {
	if (!(await isAchievementsEnabled())) return null;
	const result = evaluateAchievements({
		state: await loadAchievementsState(),
		finishedSessions: opts.finishedSessions,
		justFinished: opts.justFinished,
		questGoalJustMet: opts.questGoalJustMet,
		newPrCount: opts.newPrCount
	});
	await saveAchievementsState(result.state);
	if (result.newlyUnlocked.length > 0) {
		await kvSetJson(LAST_UNLOCK_KEY, {
			sessionId: opts.justFinished.id,
			ids: result.newlyUnlocked
		} satisfies LastAchievementUnlock);
	}
	return result;
}
