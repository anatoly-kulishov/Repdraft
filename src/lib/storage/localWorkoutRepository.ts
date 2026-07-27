import {
	DRAFT_STORAGE_KEY,
	PLANS_STORAGE_KEY,
	type WorkoutRepository
} from '$lib/domain/repository';
import type { WorkoutPlan } from '$lib/domain/types';

function readPlans(): WorkoutPlan[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(PLANS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as WorkoutPlan[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writePlans(plans: WorkoutPlan[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
}

export function readDraft(): WorkoutPlan | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as WorkoutPlan;
	} catch {
		return null;
	}
}

export function writeDraft(plan: WorkoutPlan): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(plan));
}

export const localWorkoutRepository: WorkoutRepository = {
	async list() {
		return readPlans().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	},

	async get(id: string) {
		return readPlans().find((plan) => plan.id === id) ?? null;
	},

	async save(plan: WorkoutPlan) {
		const plans = readPlans();
		const index = plans.findIndex((p) => p.id === plan.id);
		if (index >= 0) {
			plans[index] = plan;
		} else {
			plans.push(plan);
		}
		writePlans(plans);
	},

	async remove(id: string) {
		writePlans(readPlans().filter((plan) => plan.id !== id));
	}
};
