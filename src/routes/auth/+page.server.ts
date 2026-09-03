import type { PageServerLoad } from './$types';

/** Cookie peek set in app.html + auth store before Svelte mounts. */
export const load: PageServerLoad = ({ cookies }) => {
	const accountBoot = cookies.get('repdraft_auth_boot') === '1';
	return {
		bootPeek: {
			accountBoot
		}
	};
};
