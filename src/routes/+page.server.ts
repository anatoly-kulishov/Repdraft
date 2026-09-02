import { HOME_RECENT_ROW_LIMIT } from '$lib/domain/home';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';
import type { PageServerLoad } from './$types';

export const prerender = PRERENDER_PUBLIC;

/** Cookie peek set in app.html + localSessionRepository before Svelte mounts. */
export const load: PageServerLoad = ({ cookies }) => {
	const activeSession = cookies.get('repdraft_home_active') === '1';
	const hasHistory = cookies.get('repdraft_home_has_history') === '1';
	const accountBoot = cookies.get('repdraft_auth_boot') === '1';
	const homeBootRaw = cookies.get('repdraft_home_boot');
	const homeBootFromCookie = homeBootRaw === 'create' ? 'create' : 'start';
	const homeBoot = accountBoot ? 'start' : homeBootFromCookie;
	const showChecklist = cookies.get('repdraft_onboarding_checklist') === '1';
	return {
		bootPeek: {
			activeSession,
			hasHistory,
			recentRows: hasHistory ? HOME_RECENT_ROW_LIMIT : 0,
			accountBoot,
			homeBoot,
			showChecklist
		}
	};
};
