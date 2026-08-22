import { goto } from '$app/navigation';
import { isSessionFullyLogged } from '$lib/domain/session';
import type { WorkoutPlan } from '$lib/domain/types';
import { pickDefaultExerciseIndex } from '$lib/live/sessionUi';
import { live } from '$lib/stores/live';
import { plans } from '$lib/stores/plans';
import { get } from 'svelte/store';

export type LiveBootResult =
	| { kind: 'resume'; selectedExerciseIndex: number; openFinishOffer: boolean }
	| { kind: 'switch'; pendingSwitchPlan: WorkoutPlan; resumeActivePlanId: string }
	| { kind: 'missing' }
	| { kind: 'redirect'; href: string }
	| { kind: 'started'; selectedExerciseIndex: number };

/** Resolve /live/[planId] entry: resume, switch offer, new session, or missing plan. */
export async function bootLivePage(planId: string): Promise<LiveBootResult> {
	const active = get(live).session;
	const plan = await plans.getPlan(planId);

	if (active && !active.finishedAt && active.planId === planId && active.exercises.length > 0) {
		if (plan) live.syncFromPlan(plan);
		const current = get(live).session ?? active;
		const selectedExerciseIndex = pickDefaultExerciseIndex(current);
		return {
			kind: 'resume',
			selectedExerciseIndex,
			openFinishOffer: isSessionFullyLogged(current)
		};
	}

	if (active && !active.finishedAt && active.planId && active.planId !== planId) {
		if (!plan || plan.exercises.length === 0) return { kind: 'missing' };
		return {
			kind: 'switch',
			pendingSwitchPlan: plan,
			resumeActivePlanId: active.planId
		};
	}

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
