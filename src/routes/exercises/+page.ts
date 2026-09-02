import type { PageLoad } from './$types';
import { loadCatalogHub } from '$lib/data/loadCatalogPage';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';

export const prerender = PRERENDER_PUBLIC;

export const load: PageLoad = async ({ fetch }) => {
	return loadCatalogHub(fetch);
};
