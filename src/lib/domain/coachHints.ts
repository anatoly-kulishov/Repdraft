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
