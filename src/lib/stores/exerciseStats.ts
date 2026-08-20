import { browser } from '$app/environment';
import type { UserExerciseStatsMap } from '$lib/domain/exerciseScore';
import {
	readExerciseStats,
	recordExerciseUse,
	recordExerciseUses
} from '$lib/storage/localExerciseStatsRepository';
import { writable } from 'svelte/store';

function createExerciseStatsStore() {
	const { subscribe, set } = writable<UserExerciseStatsMap>(browser ? readExerciseStats() : {});

	return {
		subscribe,
		refresh() {
			if (!browser) return;
			set(readExerciseStats());
		},
		recordUse(exerciseId: string) {
			if (!browser || !exerciseId) return;
			recordExerciseUse(exerciseId);
			set(readExerciseStats());
		},
		recordUses(exerciseIds: string[]) {
			if (!browser || exerciseIds.length === 0) return;
			recordExerciseUses(exerciseIds);
			set(readExerciseStats());
		}
	};
}

export const exerciseStats = createExerciseStatsStore();
