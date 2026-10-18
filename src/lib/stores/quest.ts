import { browser } from '$app/environment';
import {
	QUEST_STATE_STORAGE_KEY,
	applyFinishedSessionToQuest,
	createInitialQuestState,
	parseQuestState,
	setWeeklyGoal as setWeeklyGoalState,
	type QuestApplyResult,
	type QuestState
} from '$lib/domain/quest';
import type { WorkoutSession } from '$lib/domain/types';
import { get, writable } from 'svelte/store';

function readState(): QuestState {
	if (!browser) return createInitialQuestState();
	try {
		const raw = localStorage.getItem(QUEST_STATE_STORAGE_KEY);
		if (!raw) return createInitialQuestState();
		return parseQuestState(JSON.parse(raw) as unknown);
	} catch {
		return createInitialQuestState();
	}
}

function writeState(state: QuestState) {
	if (!browser) return;
	try {
		localStorage.setItem(QUEST_STATE_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* ignore quota */
	}
}

const QUEST_LAST_APPLY_KEY = 'repdraft:quest-last-apply';

type StoredLastApply = {
	sessionId: string;
	apply: QuestApplyResult;
};

function readLastApply(): QuestApplyResult | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(QUEST_LAST_APPLY_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredLastApply;
		return parsed?.apply ?? null;
	} catch {
		return null;
	}
}

function writeLastApply(sessionId: string, apply: QuestApplyResult) {
	if (!browser) return;
	try {
		localStorage.setItem(
			QUEST_LAST_APPLY_KEY,
			JSON.stringify({ sessionId, apply } satisfies StoredLastApply)
		);
	} catch {
		/* ignore */
	}
}

const stateStore = writable<QuestState>(readState());
const lastApplyStore = writable<QuestApplyResult | null>(readLastApply());

if (browser) {
	stateStore.subscribe((state) => writeState(state));
}

export const questState = {
	subscribe: stateStore.subscribe
};

export const questLastApply = {
	subscribe: lastApplyStore.subscribe
};

export const quest = {
	reload() {
		stateStore.set(readState());
	},
	setWeeklyGoal(goal: number) {
		stateStore.update((s) => setWeeklyGoalState(s, goal));
	},
	/** After a successful persist of a finished session. Idempotent. */
	noteFinishedSession(session: WorkoutSession): QuestApplyResult {
		const result = applyFinishedSessionToQuest(get(stateStore), session, new Date());
		stateStore.set(result.state);
		lastApplyStore.set(result);
		writeLastApply(session.id, result);
		return result;
	},
	loadLastApplyForSession(sessionId: string): QuestApplyResult | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem(QUEST_LAST_APPLY_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as StoredLastApply;
			if (parsed.sessionId !== sessionId) return null;
			return parsed.apply;
		} catch {
			return null;
		}
	},
	clearLastApply() {
		lastApplyStore.set(null);
	},
	hydrateLastApplyForSession(sessionId: string) {
		const apply = quest.loadLastApplyForSession(sessionId);
		if (apply) lastApplyStore.set(apply);
	}
};
