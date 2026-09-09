import { HOME_RECENT_ROW_LIMIT, type HomeSkeletonVariant } from '$lib/domain/home';
import { peekAccountBoot } from '$lib/storage/homeBootPeek';
import { peekLocalHistoryCount } from '$lib/storage/localSessionRepository';
import { peekHasLocalPlans } from '$lib/storage/localWorkoutRepository';
import { peekShouldShowChecklist } from '$lib/domain/onboarding';

export type HomeClientBootPeek = {
	activeSession: boolean;
	hasHistory: boolean;
	hasPlans: boolean;
	recentRows: number;
	accountBoot: boolean;
	homeBoot: HomeSkeletonVariant;
	showChecklist: boolean;
};

function cookieHas(nameEq: string): boolean {
	try {
		return document.cookie.includes(nameEq);
	} catch {
		return false;
	}
}

/**
 * Client boot-peek for Home (native SPA / hydrated web).
 * Mirrors +page.server.ts cookie logic + localStorage peeks so guest skeleton does not flash.
 */
export function readHomeClientBootPeek(): HomeClientBootPeek {
	if (typeof document === 'undefined') {
		return {
			activeSession: false,
			hasHistory: false,
			hasPlans: false,
			recentRows: 0,
			accountBoot: false,
			homeBoot: 'start',
			showChecklist: false
		};
	}

	const accountBoot = peekAccountBoot();
	const hasPlans =
		peekHasLocalPlans() ||
		document.documentElement.dataset.homeHasPlans === '1' ||
		cookieHas('repdraft_home_has_plans=1');
	const activeSession =
		document.documentElement.dataset.homeActiveSession === '1' ||
		cookieHas('repdraft_home_active=1');
	const hasHistory =
		peekLocalHistoryCount() > 0 ||
		document.documentElement.dataset.homeHasHistory === '1' ||
		cookieHas('repdraft_home_has_history=1');

	const fromDom = document.documentElement.dataset.homeBoot;
	const homeBootRaw = fromDom === 'create' || fromDom === 'start' ? fromDom : null;
	const homeBoot: HomeSkeletonVariant =
		accountBoot || hasPlans || homeBootRaw !== 'create' ? 'start' : 'create';

	const showChecklist =
		peekShouldShowChecklist() || cookieHas('repdraft_onboarding_checklist=1');

	return {
		activeSession,
		hasHistory,
		hasPlans,
		recentRows: hasHistory ? HOME_RECENT_ROW_LIMIT : 0,
		accountBoot,
		homeBoot,
		showChecklist
	};
}
