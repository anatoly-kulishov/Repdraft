import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Lab path retired — product surface is `/ai`. */
export const load: PageServerLoad = () => {
	redirect(308, '/ai');
};
