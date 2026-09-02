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
export function peekLocalPlanCount(): number {
	return readPlans().length;
}

/** Sync peek for loading skeletons (preview, row counts). */
export function peekLocalPlan(id: string): WorkoutPlan | null {
	return readPlans().find((plan) => plan.id === id) ?? null;
}

const PREVIEW_ROWS_KEY_PREFIX = 'repdraft:preview-rows:';

/** Remember exercise count before navigating to /workouts/[id] (preview skeleton). */
export function syncPreviewExerciseRowsPeek(planId: string, exerciseCount: number): void {
	if (typeof sessionStorage === 'undefined' || !planId) return;
	try {
		const n = Math.min(Math.max(exerciseCount, 0), 6);
		sessionStorage.setItem(PREVIEW_ROWS_KEY_PREFIX + planId, String(n));
	} catch {
		/* ignore */
	}
}

/** Sync peek for preview skeleton row count (local plan or last navigation hint). */
export function peekPreviewExerciseRows(planId: string): number {
	if (!planId) return 0;
	const local = peekLocalPlan(planId);
	if (local) return local.exercises.length;
	if (typeof sessionStorage !== 'undefined') {
		try {
			const raw = sessionStorage.getItem(PREVIEW_ROWS_KEY_PREFIX + planId);
			if (raw) {
				const n = Number.parseInt(raw, 10);
				if (Number.isFinite(n) && n > 0) return n;
			}
		} catch {
			/* ignore */
		}
	}
	return 0;
}

/** Keep SSR cookie in sync so `/workouts` skeleton row count matches first paint. */
export function syncWorkoutsPlanRowsCookie(planCount: number): void {
	if (typeof document === 'undefined') return;
	try {
		const capped = Math.min(Math.max(planCount, 0), 4);
		document.documentElement.dataset.workoutsPlanRows = String(capped);
		document.cookie = `repdraft_workouts_plan_rows=${capped}; path=/; Max-Age=31536000; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}

import type { HomeSkeletonVariant } from '$lib/domain/home';
import { syncHomeBootPeek } from '$lib/storage/homeBootPeek';

/** Keep SSR cookie in sync so `/` boots the matching skeleton. */
export function syncHomePlansBootCookie(hasPlans: boolean): void {
	if (typeof document === 'undefined') return;
	try {
		if (hasPlans) {
			document.cookie = 'repdraft_home_has_plans=1; path=/; Max-Age=31536000; SameSite=Lax';
			syncHomeBootPeek('start');
		} else {
			document.cookie = 'repdraft_home_has_plans=; path=/; Max-Age=0; SameSite=Lax';
			if (document.documentElement.dataset.authBoot !== 'account') {
				syncHomeBootPeek('create');
			} else {
				syncHomeBootPeek('start');
			}
		}
	} catch {
		/* ignore */
	}
}

/** Keep SSR cookie in sync so `/builder` skeleton variant matches first paint. */
export function syncBuilderDraftBootCookie(exerciseCount: number): void {
	if (typeof document === 'undefined') return;
	try {
		const safe = Math.min(Math.max(exerciseCount, 0), 99);
		document.documentElement.dataset.builderDraftRows = String(Math.min(safe, 4));
		document.cookie = `repdraft_builder_draft_rows=${safe}; path=/; Max-Age=31536000; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}

/** Sync peek for builder skeleton (empty vs list + row count). */
export function peekBuilderDraftExerciseCount(): number {
	if (typeof localStorage !== 'undefined') {
		const stored = readDraft();
		if (stored) return stored.exercises.length;
	}
	if (typeof document !== 'undefined') {
		const fromCookie = document.cookie.match(/(?:^|;\s*)repdraft_builder_draft_rows=(\d+)/);
		if (fromCookie) {
			const parsed = Number.parseInt(fromCookie[1] ?? '', 10);
			if (Number.isFinite(parsed) && parsed >= 0) return parsed;
		}
		const fromDom = document.documentElement.dataset.builderDraftRows;
		if (fromDom != null) {
			const parsed = Number.parseInt(fromDom, 10);
			if (Number.isFinite(parsed) && parsed >= 0) return parsed;
		}
	}
	return 0;
}

function writePlans(plans: WorkoutPlan[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
	syncHomePlansBootCookie(plans.length > 0);
	syncWorkoutsPlanRowsCookie(plans.length);
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
	syncBuilderDraftBootCookie(plan.exercises.length);
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
