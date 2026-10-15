import {
	visibleSessionExerciseIndices
} from '@repdraft/domain/session';
import type { SessionExercise, WorkoutSession } from '@repdraft/domain/types';

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

export function isLiveResumePlanId(
	planId: string,
	active: Pick<WorkoutSession, 'planId'> | null | undefined
): boolean {
	if (!active) return false;
	if (planId === 'active') return true;
	if (active.planId != null) return active.planId === planId;
	return planId === 'active' || planId === 'null' || planId === 'undefined' || planId === '';
}

export function formatElapsedClock(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	const mm = String(m).padStart(2, '0');
	const ss = String(s).padStart(2, '0');
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
