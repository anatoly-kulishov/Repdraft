import {
	QUEST_ENABLED_STORAGE_KEY,
	QUEST_STATE_STORAGE_KEY,
	applyFinishedSessionToQuest,
	createInitialQuestState,
	parseQuestEnabled,
	parseQuestState,
	setWeeklyGoal as setGoal,
	type QuestApplyResult,
	type QuestState
} from '@repdraft/domain/quest';
import type { WorkoutSession } from '@repdraft/domain/types';
import { kvGet, kvSet, kvSetJson, kvGetJson } from '../storage/kv';

export async function isQuestEnabled(): Promise<boolean> {
	return parseQuestEnabled(await kvGet(QUEST_ENABLED_STORAGE_KEY));
}

export async function setQuestEnabled(on: boolean): Promise<void> {
	await kvSet(QUEST_ENABLED_STORAGE_KEY, on ? '1' : '0');
}

export async function loadQuestState(): Promise<QuestState> {
	const raw = await kvGetJson<unknown>(QUEST_STATE_STORAGE_KEY, null);
	return parseQuestState(raw ?? createInitialQuestState());
}

export async function saveQuestState(state: QuestState): Promise<void> {
	await kvSetJson(QUEST_STATE_STORAGE_KEY, state);
}

export async function setWeeklyGoal(goal: number): Promise<QuestState> {
	const next = setGoal(await loadQuestState(), goal);
	await saveQuestState(next);
	return next;
}

export async function noteFinishedSession(session: WorkoutSession): Promise<QuestApplyResult | null> {
	if (!(await isQuestEnabled())) return null;
	const result = applyFinishedSessionToQuest(await loadQuestState(), session, new Date());
	await saveQuestState(result.state);
	return result;
}
