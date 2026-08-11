import type { SessionExercise, WorkoutSession } from '$lib/domain/types';

export function pickDefaultExerciseIndex(session: WorkoutSession): number {
	const idx = session.exercises.findIndex(
		(ex) => ex.sets.length > 0 && !ex.sets.every((s) => s.completed)
	);
	return idx >= 0 ? idx : 0;
}

export function exerciseAllSetsDone(exercises: SessionExercise[], index: number): boolean {
	const ex = exercises[index];
	if (!ex || ex.sets.length === 0) return false;
	return ex.sets.every((s) => s.completed);
}
