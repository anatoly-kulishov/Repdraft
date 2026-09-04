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

/** Home / deep-link into the unfinished live session. */
export function liveContinueHref(session: Pick<WorkoutSession, 'planId'>): string {
	if (session.planId) return `/live/${encodeURIComponent(session.planId)}`;
	// planId null (cloud strip / orphan): dedicated resume alias, not `/live/null`.
	return '/live/active';
}

/**
 * True when `/live/[planId]` should reopen `active` instead of starting/switching.
 * Handles `active` alias and the bad `/live/null` href from stringifying a null planId.
 */
export function isLiveResumePlanId(
	planId: string,
	active: Pick<WorkoutSession, 'planId'> | null | undefined
): boolean {
	if (!active) return false;
	if (planId === 'active') return true;
	if (active.planId != null) return active.planId === planId;
	return planId === 'active' || planId === 'null' || planId === 'undefined' || planId === '';
}

export function runLiveSessionUiSelfCheck(): void {
	if (liveContinueHref({ planId: 'abc' }) !== '/live/abc') {
		throw new Error('liveContinueHref planId');
	}
	if (liveContinueHref({ planId: null }) !== '/live/active') {
		throw new Error('liveContinueHref null planId');
	}
	if (!isLiveResumePlanId('active', { planId: 'x' })) {
		throw new Error('isLiveResumePlanId active alias');
	}
	if (!isLiveResumePlanId('null', { planId: null })) {
		throw new Error('isLiveResumePlanId null sentinel');
	}
	if (isLiveResumePlanId('other', { planId: 'x' })) {
		throw new Error('isLiveResumePlanId reject other plan');
	}
}
