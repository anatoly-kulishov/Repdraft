import { addExercise } from '@repdraft/domain/workout';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { readHomeNextPlanId } from '../live/homeNext';
import { plansRepo } from '../storage/plansRepo';
import { pushPlan } from '../sync/cloudSync';

export async function appendExerciseToHomePlan(exerciseId: string): Promise<string | null> {
	const [plans, pinnedId] = await Promise.all([plansRepo.list(), readHomeNextPlanId()]);
	const plan =
		(pinnedId ? plans.find((p) => p.id === pinnedId) : null) ?? plans[0] ?? null;
	if (!plan) return null;
	if (plan.exercises.some((e) => e.exerciseId === exerciseId)) return plan.id;
	const { plan: next } = addExercise(plan, exerciseId);
	const saved: WorkoutPlan = { ...next, updatedAt: new Date().toISOString() };
	await plansRepo.save(saved);
	try {
		await pushPlan(saved);
	} catch {
		/* offline */
	}
	return saved.id;
}
