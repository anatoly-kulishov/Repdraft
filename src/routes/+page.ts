import type { PageLoad } from './$types';
import type { HomeSkeletonVariant } from '$lib/domain/home';

const emptyBootPeek = {
	activeSession: false,
	hasHistory: false,
	hasPlans: false,
	recentRows: 0,
	accountBoot: false,
	homeBoot: 'start' as HomeSkeletonVariant,
	showChecklist: false
};

/** Native SPA (no +page.server): empty peek; client peeks fill in on mount. */
export const load: PageLoad = ({ data }) => ({
	...data,
	bootPeek: data.bootPeek ?? emptyBootPeek
});
