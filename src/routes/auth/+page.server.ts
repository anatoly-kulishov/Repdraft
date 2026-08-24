import type { PageServerLoad } from './$types';

/** Lets /auth SSR the correct boot skeleton (account vs guest). */
export const load: PageServerLoad = ({ cookies }) => {
	return {
		bootLikelyAccount: cookies.get('repdraft_auth_boot') === '1'
	};
};
