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

/** Sync peek for Home boot skeleton (create vs start). */
export function peekHasLocalPlans(): boolean {
	return readPlans().length > 0;
}

/** Sync peek for loading skeletons (preview, row counts). */
export function peekLocalPlan(id: string): WorkoutPlan | null {
	return readPlans().find((plan) => plan.id === id) ?? null;
}

/** Keep SSR cookie in sync so `/` boots the matching skeleton. */
export function syncHomePlansBootCookie(hasPlans: boolean): void {
	if (typeof document === 'undefined') return;
	try {
		if (hasPlans) {
			document.cookie = 'repdraft_home_has_plans=1; path=/; Max-Age=31536000; SameSite=Lax';
			document.documentElement.dataset.homeBoot = 'start';
		} else {
			document.cookie = 'repdraft_home_has_plans=; path=/; Max-Age=0; SameSite=Lax';
			if (document.documentElement.dataset.authBoot !== 'account') {
				document.documentElement.dataset.homeBoot = 'create';
			} else {
				document.documentElement.dataset.homeBoot = 'start';
			}
		}
	} catch {
		/* ignore */
	}
}

function writePlans(plans: WorkoutPlan[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
	syncHomePlansBootCookie(plans.length > 0);
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

/** Replace entire local plans list (after cloud merge). */
export function replaceAllPlans(plans: WorkoutPlan[]): void {
	writePlans(plans);
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
