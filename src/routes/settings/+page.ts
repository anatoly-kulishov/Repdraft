import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Language lives on /auth; theme toggle is in the sidebar. */
export const load: PageLoad = () => {
	redirect(308, '/auth');
};
