import { rotatePlanIdToEnd, syncPlanOrderIds } from '@repdraft/domain/workout';
import { kvGetJson, kvRemove, kvSetJson } from '../storage/kv';

export const PLAN_ORDER_STORAGE_KEY = 'repdraft:plan-order';

export async function readPlanOrder(): Promise<string[]> {
	const parsed = await kvGetJson<unknown>(PLAN_ORDER_STORAGE_KEY, []);
	return Array.isArray(parsed)
		? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
		: [];
}

export async function writePlanOrder(order: string[]): Promise<void> {
	if (order.length === 0) await kvRemove(PLAN_ORDER_STORAGE_KEY);
	else await kvSetJson(PLAN_ORDER_STORAGE_KEY, order);
}

export async function movePlanToEnd(planId: string, planIds: string[]): Promise<string[]> {
	const synced = syncPlanOrderIds(await readPlanOrder(), planIds);
	const next = rotatePlanIdToEnd(synced, planId);
	await writePlanOrder(next);
	return next;
}
