import {
	PLANS_STORAGE_KEY,
	type WorkoutRepository
} from '@repdraft/domain/repository';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { kvGetJson, kvSetJson } from './kv';

async function readAll(): Promise<WorkoutPlan[]> {
	const list = await kvGetJson<WorkoutPlan[]>(PLANS_STORAGE_KEY, []);
	return Array.isArray(list) ? list : [];
}

async function writeAll(plans: WorkoutPlan[]): Promise<void> {
	await kvSetJson(PLANS_STORAGE_KEY, plans);
}

export const plansRepo: WorkoutRepository = {
	async list() {
		const plans = await readAll();
		return [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	},
	async get(id) {
		return (await readAll()).find((p) => p.id === id) ?? null;
	},
	async save(plan) {
		const plans = await readAll();
		const idx = plans.findIndex((p) => p.id === plan.id);
		if (idx >= 0) plans[idx] = plan;
		else plans.push(plan);
		await writeAll(plans);
	},
	async remove(id) {
		await writeAll((await readAll()).filter((p) => p.id !== id));
	}
};
