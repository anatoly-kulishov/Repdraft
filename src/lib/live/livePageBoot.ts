import { goto } from '$app/navigation';
import { isSessionFullyLogged } from '$lib/domain/session';
import type { WorkoutPlan } from '$lib/domain/types';
import { isLiveResumePlanId, pickDefaultExerciseIndex } from '$lib/live/sessionUi';
import { live } from '$lib/stores/live';
import { plans } from '$lib/stores/plans';
import { get } from 'svelte/store';

export type LiveBootResult =
	| { kind: 'resume'; selectedExerciseIndex: number; openFinishOffer: boolean }
	| { kind: 'switch'; pendingSwitchPlan: WorkoutPlan; resumeActivePlanId: string }
	| { kind: 'missing' }
	| { kind: 'redirect'; href: string }
	| { kind: 'started'; selectedExerciseIndex: number };

async function resumeActiveSession(activePlanId: string | null): Promise<LiveBootResult> {
	const active = get(live).session;
	if (!active || active.finishedAt || active.exercises.length === 0) {
		return { kind: 'missing' };
	}
	const planId = activePlanId ?? active.planId;
	if (planId) {
		const plan = await plans.getPlan(planId);
		if (plan) live.syncFromPlan(plan);
	}
	const current = get(live).session ?? active;
	return {
		kind: 'resume',
		selectedExerciseIndex: pickDefaultExerciseIndex(current),
		openFinishOffer: isSessionFullyLogged(current)
	};
}

/** Resolve /live/[planId] entry: resume, switch offer, new session, or missing plan. */
export async function bootLivePage(planId: string): Promise<LiveBootResult> {
	const active = get(live).session;

	// Unfinished session first — do not depend on the plan still existing in the library.
	if (active && !active.finishedAt && active.exercises.length > 0) {
		if (isLiveResumePlanId(planId, active)) {
			return resumeActiveSession(active.planId);
		}
		if (active.planId && active.planId !== planId) {
			const plan = await plans.getPlan(planId);
			if (!plan || plan.exercises.length === 0) {
				// Requested template is gone; keep the athlete in the open session.
				return resumeActiveSession(active.planId);
			}
			return {
				kind: 'switch',
				pendingSwitchPlan: plan,
				resumeActivePlanId: active.planId
			};
		}
	}

	const plan = await plans.getPlan(planId);
	if (!plan || plan.exercises.length === 0) return { kind: 'missing' };

	const nav = performance.getEntriesByType?.('navigation')?.[0] as
		| PerformanceNavigationTiming
		| undefined;
	if (nav?.type === 'back_forward') {
		await goto('/workouts?tab=history', { replaceState: true });
		return { kind: 'redirect', href: '/workouts?tab=history' };
	}

	await live.startFromPlan(plan);
	const started = get(live).session;
	return {
		kind: 'started',
		selectedExerciseIndex: started ? pickDefaultExerciseIndex(started) : 0
	};
}
