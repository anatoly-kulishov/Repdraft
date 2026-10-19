import {
	QUEST_STATE_STORAGE_KEY,
	applyFinishedSessionToQuest,
	createInitialQuestState,
	parseQuestState,
	setWeeklyGoal as setGoal,
	type QuestApplyResult,
	type QuestState
} from '@repdraft/domain/quest';
import type { WorkoutSession } from '@repdraft/domain/types';
import { kvSetJson, kvGetJson } from '../storage/kv';

const QUEST_LAST_APPLY_KEY = 'repdraft:quest-last-apply';

type StoredLastApply = {
	sessionId: string;
	apply: QuestApplyResult;
};

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

export async function loadLastQuestApply(sessionId: string): Promise<QuestApplyResult | null> {
	const raw = await kvGetJson<StoredLastApply | null>(QUEST_LAST_APPLY_KEY, null);
	if (!raw || raw.sessionId !== sessionId || !raw.apply) return null;
	return raw.apply;
}

export async function noteFinishedSession(
	session: WorkoutSession,
	prior: readonly WorkoutSession[] = []
): Promise<QuestApplyResult> {
	const result = applyFinishedSessionToQuest(await loadQuestState(), session, new Date(), prior);
	await saveQuestState(result.state);
	await kvSetJson(QUEST_LAST_APPLY_KEY, {
		sessionId: session.id,
		apply: result
	} satisfies StoredLastApply);
	return result;
}
