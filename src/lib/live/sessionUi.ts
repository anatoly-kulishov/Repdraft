import type { SessionExercise, WorkoutSession } from '$lib/domain/types';
import { visibleSessionExerciseIndices } from '$lib/domain/session';

export function pickDefaultExerciseIndex(session: WorkoutSession): number {
	const visible = visibleSessionExerciseIndices(session);
	for (const idx of visible) {
		const ex = session.exercises[idx];
		if (ex && ex.sets.length > 0 && !ex.sets.every((s) => s.completed)) return idx;
	}
	return visible[0] ?? 0;
}

export function exerciseAllSetsDone(exercises: SessionExercise[], index: number): boolean {
	const ex = exercises[index];
	if (!ex || ex.sets.length === 0) return false;
	return ex.sets.every((s) => s.completed);
}
