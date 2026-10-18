import { browser } from '$app/environment';
import { addExercise } from '$lib/domain/workout';
import { isCloudPersistableId } from '$lib/domain/id';
import type { WorkoutPlan } from '$lib/domain/types';
import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
import { isCloudMode } from '$lib/storage/dataAccess';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';
import { mirrorCloudWrite } from '$lib/stores/cloudLocal';
import { homeNextPlan } from '$lib/stores/homeNextPlan';
import { plans } from '$lib/stores/plans';
import { get } from 'svelte/store';

export async function appendExerciseToHomePlan(exerciseId: string): Promise<string | null> {
	if (!browser) return null;
	const list = get(plans);
	const pinned = get(homeNextPlan);
	const plan =
		(pinned ? list.find((p) => p.id === pinned) : null) ?? list[0] ?? null;
	if (!plan) return null;
	if (plan.exercises.some((e) => e.exerciseId === exerciseId)) return plan.id;
	const { plan: next } = addExercise(plan, exerciseId);
	const saved: WorkoutPlan = { ...next, updatedAt: new Date().toISOString() };
	await mirrorCloudWrite({
		localWrite: () => localWorkoutRepository.save(saved),
		cloudWrite: isCloudPersistableId(saved.id)
			? () => supabaseWorkoutRepository.save(saved)
			: undefined,
		cloudId: saved.id,
		label: 'planPatch.appendExercise',
		announceLocalSave: false,
		outboxOnFail: isCloudPersistableId(saved.id)
			? { kind: 'plan.save', id: saved.id }
			: undefined
	});
	await plans.refresh({ cloud: isCloudMode() });
	return saved.id;
}
