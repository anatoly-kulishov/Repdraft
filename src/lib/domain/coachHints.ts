import type { ExerciseIndexItem } from './types';
import type { WorkoutSession } from './types';
import {
	finishedSessionsWithinDays,
	laggingBodyParts,
	pickCatalogExerciseForBodyPart,
	sessionVolumeByBodyPart,
	mergeVolumeMaps
} from './trainingLoad';

export type CoachHint = {
	id: string;
	bodyPart: string;
	exerciseId: string;
	reasonKey: 'coach.hintLagging' | 'coach.hintBalance';
};

export type CoachReplace = {
	fromExerciseId: string;
	toExerciseId: string;
	bodyPart: string;
};

/** Swap one plan exercise that sits on a lagging body part. */
export function suggestPlanReplace(
	planExerciseIds: readonly string[],
	lagging: readonly string[],
	catalog: readonly ExerciseIndexItem[],
	bodyPartFor: (exerciseId: string) => string | null
): CoachReplace | null {
	for (const part of lagging) {
		const fromExerciseId = planExerciseIds.find((id) => bodyPartFor(id) === part);
		if (!fromExerciseId) continue;
		const toExerciseId = pickCatalogExerciseForBodyPart(
			catalog,
			part,
			new Set([...planExerciseIds, fromExerciseId])
		);
		if (!toExerciseId || toExerciseId === fromExerciseId) continue;
		return { fromExerciseId, toExerciseId, bodyPart: part };
	}
	return null;
}

export function buildCoachHints(
	focusSession: WorkoutSession,
	finishedSessions: readonly WorkoutSession[],
	catalog: readonly ExerciseIndexItem[],
	bodyPartFor: (exerciseId: string) => string | null,
	now: Date = new Date()
): CoachHint[] {
	const recent = finishedSessionsWithinDays([...finishedSessions], 30, now);
	if (recent.length === 0) return [];

	const todayMap = sessionVolumeByBodyPart(focusSession, bodyPartFor);
	const windowMaps = recent.map((s) => sessionVolumeByBodyPart(s, bodyPartFor));
	const windowMap = mergeVolumeMaps(windowMaps);
	const lagging = laggingBodyParts(todayMap, windowMap);

	const hints: CoachHint[] = [];
	for (const part of lagging) {
		const exerciseId = pickCatalogExerciseForBodyPart(catalog, part);
		if (!exerciseId) continue;
		hints.push({
			id: `lag-${part}-${exerciseId}`,
			bodyPart: part,
			exerciseId,
			reasonKey: 'coach.hintLagging'
		});
		if (hints.length >= 3) break;
	}
	return hints;
}
