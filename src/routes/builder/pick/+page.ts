import { redirect } from '@sveltejs/kit';
import { BUILDER_ADD_EXERCISE_HREF } from '$lib/domain/catalogLinks';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	redirect(308, BUILDER_ADD_EXERCISE_HREF);
};
