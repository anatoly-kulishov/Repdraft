import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { searchSuffix } from '$lib/navigation/urlSearchParams';

/** Legacy top-level path — canonical route is /exercises/records. */
export const load: PageLoad = ({ url }) => {
	redirect(308, `/exercises/records${searchSuffix(url)}`);
};
