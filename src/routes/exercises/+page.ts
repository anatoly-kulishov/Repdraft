import type { PageLoad } from './$types';
import { loadArticlesForLocale } from '$lib/data/loadArticles';
import { loadCatalogHub } from '$lib/data/loadCatalogPage';

export const load: PageLoad = async ({ fetch }) => {
	const [hub, articles] = await Promise.all([
		loadCatalogHub(fetch),
		loadArticlesForLocale('ru', fetch)
	]);
	return { ...hub, articles };
};
