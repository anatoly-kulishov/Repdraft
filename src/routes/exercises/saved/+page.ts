import type { PageLoad } from './$types';
import { loadCatalogIndex } from '$lib/data/loadCatalogPage';

export const load: PageLoad = async ({ fetch, data }) => ({
	...(await loadCatalogIndex(fetch)),
	bookmarksCountPeek: data.bookmarksCountPeek
});
