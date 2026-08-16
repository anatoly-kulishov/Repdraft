import { loadArticles } from '$lib/data/loadArticles';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const articles = await loadArticles(fetch);
	return { articles };
};
