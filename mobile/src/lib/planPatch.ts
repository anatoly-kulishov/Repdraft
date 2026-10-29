import { addExercise, removeExercise, replacePlanExercise } from '@repdraft/domain/workout';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { readHomeNextPlanId } from '../live/homeNext';
import { plansRepo } from '../storage/plansRepo';
import { pushPlan } from '../sync/cloudSync';

export type HomePlanPatchResult = {
	planId: string;
	/** False when the exercise was already there (nothing to undo). */
	added: boolean;
};

async function homePlan(): Promise<WorkoutPlan | null> {
	const [plans, pinnedId] = await Promise.all([plansRepo.list(), readHomeNextPlanId()]);
	return (pinnedId ? plans.find((p) => p.id === pinnedId) : null) ?? plans[0] ?? null;
}

/** Add to the pinned/home plan (summary, import flows). */
export async function appendExerciseToHomePlan(
	exerciseId: string
): Promise<HomePlanPatchResult | null> {
	const plan = await homePlan();
	if (!plan) return null;
	return appendExerciseToPlan(plan.id, exerciseId);
}

/** Add to an explicit plan; the caller picked it (coach hints sheet). */
export async function appendExerciseToPlan(
	planId: string,
	exerciseId: string
): Promise<HomePlanPatchResult | null> {
	const plans = await plansRepo.list();
	const plan = plans.find((p) => p.id === planId);
	if (!plan) return null;
	if (plan.exercises.some((e) => e.exerciseId === exerciseId)) {
		return { planId: plan.id, added: false };
	}
	const { plan: next } = addExercise(plan, exerciseId);
	await savePlan({ ...next, updatedAt: new Date().toISOString() });
	return { planId: plan.id, added: true };
}

/** Undo for both append helpers. */
export async function removeExerciseFromPlan(
	planId: string,
	exerciseId: string
): Promise<string | null> {
	const plans = await plansRepo.list();
	const plan = plans.find((p) => p.id === planId);
	if (!plan) return null;
	if (!plan.exercises.some((e) => e.exerciseId === exerciseId)) return plan.id;
	await savePlan({ ...removeExercise(plan, exerciseId), updatedAt: new Date().toISOString() });
	return plan.id;
}

export async function removeExerciseFromHomePlan(exerciseId: string): Promise<string | null> {
	const plan = await homePlan();
	if (!plan) return null;
	return removeExerciseFromPlan(plan.id, exerciseId);
}

export async function replaceExerciseInHomePlan(
	fromExerciseId: string,
	toExerciseId: string
): Promise<string | null> {
	const plan = await homePlan();
	if (!plan) return null;
	const next = replacePlanExercise(plan, fromExerciseId, toExerciseId);
	if (next === plan) return plan.id;
	await savePlan({ ...next, updatedAt: new Date().toISOString() });
	return plan.id;
}

async function savePlan(saved: WorkoutPlan): Promise<void> {
	await plansRepo.save(saved);
	try {
		await pushPlan(saved);
	} catch {
		/* offline */
	}
}
