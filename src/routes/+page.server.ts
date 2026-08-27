import type { PageServerLoad } from './$types';

/** Home boot: start skeleton when plans or signed-in session are likely. */
export const load: PageServerLoad = ({ cookies }) => {
	return {
		bootStart:
			cookies.get('repdraft_home_has_plans') === '1' ||
			cookies.get('repdraft_auth_boot') === '1'
	};
};
