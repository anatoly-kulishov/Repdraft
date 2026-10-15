import { advanceHomeNextPlanId } from '@repdraft/domain/workout';
import { kvGet, kvRemove, kvSet } from '../storage/kv';

export const HOME_NEXT_PLAN_STORAGE_KEY = 'repdraft:home-next-plan-id';

export async function readHomeNextPlanId(): Promise<string | null> {
	const raw = await kvGet(HOME_NEXT_PLAN_STORAGE_KEY);
	return raw && raw.length > 0 ? raw : null;
}

export async function writeHomeNextPlanId(planId: string | null): Promise<void> {
	if (planId) await kvSet(HOME_NEXT_PLAN_STORAGE_KEY, planId);
	else await kvRemove(HOME_NEXT_PLAN_STORAGE_KEY);
}

export async function advanceHomeNextAfterFinish(
	finishedPlanId: string,
	plans: { id: string }[]
): Promise<string | null> {
	const pinned = await readHomeNextPlanId();
	const nextId = advanceHomeNextPlanId(plans, finishedPlanId, pinned);
	await writeHomeNextPlanId(nextId);
	return nextId;
}
