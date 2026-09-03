/** Max finished sessions shown on Home «Недавние». Skeleton reserves the same. */
export const HOME_RECENT_ROW_LIMIT = 3;

/** First-viewport history cards on `/workouts?tab=history` boot skeleton (cookie + UI cap). */
export const WORKOUTS_HISTORY_SKELETON_ROW_LIMIT = 8;

/** History tab infinite-scroll page size (DOM only; store keeps full list). */
export const HISTORY_PAGE_SIZE = 20;

/** First-viewport plan cards on `/workouts` plans tab boot skeleton (search + list). */
export const WORKOUTS_PLANS_SKELETON_ROW_LIMIT = 6;

export type HomeSkeletonVariant = 'create' | 'start';

export type HomeSkeletonBootInput = {
	/** Dev/QA override via ?skeleton= */
	force?: HomeSkeletonVariant | null;
	/** SSR/client peek: signed-in session before Svelte auth hydrates. */
	accountBoot: boolean;
	/** SSR/client peek from repdraft_home_boot / dataset.homeBoot. */
	homeBoot?: HomeSkeletonVariant | null;
	authReady?: boolean;
	hasUser?: boolean;
	hasPlans?: boolean;
};

/**
 * Single rule set for SSR + client home boot skeletons.
 * Guest `create` only after auth confirms guest with no plans.
 * While bootstrapping, prefer `start` — never flash guest UI to signed-in users
 * (stale `repdraft_home_boot=create` cookie must not win).
 */
export function resolveHomeSkeletonVariant(input: HomeSkeletonBootInput): HomeSkeletonVariant {
	if (input.force) return input.force;
	if (input.accountBoot) return 'start';
	if (input.authReady && input.hasUser) return 'start';
	if (input.hasPlans) return 'start';
	if (input.homeBoot === 'start') return 'start';
	if (input.authReady && !input.hasUser && !input.hasPlans) return 'create';
	return 'start';
}
