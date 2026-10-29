import type { CoachAssignment } from '@repdraft/domain/coach';
import { newId } from '@repdraft/domain/id';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { writeHomeNextPlanId } from '../live/homeNext';
import { plansRepo } from '../storage/plansRepo';
import { pushPlan } from '../sync/cloudSync';

/**
 * Client imports a coach-assigned plan snapshot as their own plan and pins it
 * on Home. Mirrors web `plans.importPlan` + `homeNextPlan.pin`.
 */
export async function importAssignedPlan(assignment: CoachAssignment): Promise<WorkoutPlan> {
	const ts = new Date().toISOString();
	const plan: WorkoutPlan = {
		id: newId(),
		name: assignment.planName.trim() || assignment.planName,
		createdAt: ts,
		updatedAt: ts,
		exercises: assignment.exercises
	};
	await plansRepo.save(plan);
	try {
		await pushPlan(plan);
	} catch {
		/* offline: outbox retries later */
	}
	await writeHomeNextPlanId(plan.id);
	return plan;
}
