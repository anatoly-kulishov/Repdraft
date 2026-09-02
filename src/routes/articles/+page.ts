import { loadArticles } from '$lib/data/loadArticles';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';
import type { PageLoad } from './$types';

export const prerender = PRERENDER_PUBLIC;

export const load: PageLoad = async ({ fetch }) => {
	const articles = await loadArticles(fetch);
	return { articles };
};
