import { browser } from '$app/environment';
import { addExercise, removeExercise, replacePlanExercise } from '$lib/domain/workout';
import { isCloudPersistableId } from '$lib/domain/id';
import type { WorkoutPlan } from '$lib/domain/types';
import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
import { isCloudMode } from '$lib/storage/dataAccess';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';
import { mirrorCloudWrite } from '$lib/stores/cloudLocal';
import { homeNextPlan } from '$lib/stores/homeNextPlan';
import { plans } from '$lib/stores/plans';
import { get } from 'svelte/store';

export type HomePlanPatchResult = {
	planId: string;
	/** False when the exercise was already there (nothing to undo). */
	added: boolean;
};

function homePlan(): WorkoutPlan | null {
	const list = get(plans);
	const pinned = get(homeNextPlan);
	return (pinned ? list.find((p) => p.id === pinned) : null) ?? list[0] ?? null;
}

/** Add to the pinned/home plan (summary, import flows). */
export async function appendExerciseToHomePlan(
	exerciseId: string
): Promise<HomePlanPatchResult | null> {
	const plan = homePlan();
	if (!plan) return null;
	return appendExerciseToPlan(plan.id, exerciseId);
}

/** Add to an explicit plan; the caller picked it (coach hints sheet). */
export async function appendExerciseToPlan(
	planId: string,
	exerciseId: string
): Promise<HomePlanPatchResult | null> {
	if (!browser) return null;
	const plan = get(plans).find((p) => p.id === planId);
	if (!plan) return null;
	if (plan.exercises.some((e) => e.exerciseId === exerciseId)) {
		return { planId: plan.id, added: false };
	}
	const { plan: next } = addExercise(plan, exerciseId);
	await savePlan({ ...next, updatedAt: new Date().toISOString() }, 'planPatch.appendExercise');
	return { planId: plan.id, added: true };
}

/** Undo for both append helpers. */
export async function removeExerciseFromPlan(
	planId: string,
	exerciseId: string
): Promise<string | null> {
	if (!browser) return null;
	const plan = get(plans).find((p) => p.id === planId);
	if (!plan) return null;
	if (!plan.exercises.some((e) => e.exerciseId === exerciseId)) return plan.id;
	await savePlan(
		{ ...removeExercise(plan, exerciseId), updatedAt: new Date().toISOString() },
		'planPatch.removeExercise'
	);
	return plan.id;
}

export async function removeExerciseFromHomePlan(exerciseId: string): Promise<string | null> {
	const plan = homePlan();
	if (!plan) return null;
	return removeExerciseFromPlan(plan.id, exerciseId);
}

export async function replaceExerciseInHomePlan(
	fromExerciseId: string,
	toExerciseId: string
): Promise<string | null> {
	if (!browser) return null;
	const plan = homePlan();
	if (!plan) return null;
	const next = replacePlanExercise(plan, fromExerciseId, toExerciseId);
	if (next === plan) return plan.id;
	await savePlan({ ...next, updatedAt: new Date().toISOString() }, 'planPatch.replaceExercise');
	return plan.id;
}

async function savePlan(saved: WorkoutPlan, label: string): Promise<void> {
	await mirrorCloudWrite({
		localWrite: () => localWorkoutRepository.save(saved),
		cloudWrite: isCloudPersistableId(saved.id)
			? () => supabaseWorkoutRepository.save(saved)
			: undefined,
		cloudId: saved.id,
		label,
		announceLocalSave: false,
		outboxOnFail: isCloudPersistableId(saved.id)
			? { kind: 'plan.save', id: saved.id }
			: undefined
	});
	await plans.refresh({ cloud: isCloudMode() });
}
