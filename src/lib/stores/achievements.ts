import { browser } from '$app/environment';
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
} from '$lib/domain/achievements';
import type { WorkoutSession } from '$lib/domain/types';
import { get, writable } from 'svelte/store';

const LAST_UNLOCK_KEY = 'repdraft:achievements-last-unlock';

type LastAchievementUnlock = {
	sessionId: string;
	ids: AchievementId[];
};

function readEnabled(): boolean {
	if (!browser) return false;
	try {
		return parseAchievementsEnabled(localStorage.getItem(ACHIEVEMENTS_ENABLED_STORAGE_KEY));
	} catch {
		return false;
	}
}

function writeEnabled(on: boolean) {
	if (!browser) return;
	try {
		localStorage.setItem(ACHIEVEMENTS_ENABLED_STORAGE_KEY, on ? '1' : '0');
	} catch {
		/* ignore */
	}
}

function readState(): AchievementsState {
	if (!browser) return createInitialAchievementsState();
	try {
		const raw = localStorage.getItem(ACHIEVEMENTS_STATE_STORAGE_KEY);
		if (!raw) return createInitialAchievementsState();
		return parseAchievementsState(JSON.parse(raw) as unknown);
	} catch {
		return createInitialAchievementsState();
	}
}

function writeState(state: AchievementsState) {
	if (!browser) return;
	try {
		localStorage.setItem(ACHIEVEMENTS_STATE_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* ignore */
	}
}

const enabledStore = writable(readEnabled());
const stateStore = writable<AchievementsState>(readState());

if (browser) {
	enabledStore.subscribe((on) => writeEnabled(on));
	stateStore.subscribe((state) => writeState(state));
}

export const achievementsEnabled = {
	subscribe: enabledStore.subscribe,
	set(on: boolean) {
		enabledStore.set(on);
	}
};

export const achievementsState = {
	subscribe: stateStore.subscribe,
	reload() {
		stateStore.set(readState());
	}
};

export function loadLastAchievementUnlock(sessionId: string): AchievementId[] | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(LAST_UNLOCK_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as LastAchievementUnlock;
		if (
			!parsed ||
			parsed.sessionId !== sessionId ||
			!Array.isArray(parsed.ids) ||
			parsed.ids.length === 0
		) {
			return null;
		}
		return parsed.ids;
	} catch {
		return null;
	}
}

export function noteFinishedSessionAchievements(opts: {
	justFinished: WorkoutSession;
	finishedSessions: WorkoutSession[];
	questGoalJustMet: boolean;
	newPrCount: number;
}): AchievementEvalResult | null {
	if (!get(enabledStore)) return null;
	const result = evaluateAchievements({
		state: get(stateStore),
		finishedSessions: opts.finishedSessions,
		justFinished: opts.justFinished,
		questGoalJustMet: opts.questGoalJustMet,
		newPrCount: opts.newPrCount
	});
	stateStore.set(result.state);
	if (result.newlyUnlocked.length > 0 && browser) {
		try {
			localStorage.setItem(
				LAST_UNLOCK_KEY,
				JSON.stringify({
					sessionId: opts.justFinished.id,
					ids: result.newlyUnlocked
				} satisfies LastAchievementUnlock)
			);
		} catch {
			/* ignore */
		}
	}
	return result;
}
