/** Max finished sessions shown on Home «Недавние». Skeleton reserves the same. */
export const HOME_RECENT_ROW_LIMIT = 3;

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

/** Single rule set for SSR + client home boot skeletons. Account boot never uses guest create. */
export function resolveHomeSkeletonVariant(input: HomeSkeletonBootInput): HomeSkeletonVariant {
	if (input.force) return input.force;
	if (input.accountBoot) return 'start';
	if (input.authReady && input.hasUser) return 'start';
	if (input.homeBoot === 'create' || input.homeBoot === 'start') return input.homeBoot;
	if (input.authReady && !input.hasUser && !input.hasPlans) return 'create';
	return 'start';
}
