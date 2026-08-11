import { error } from '@sveltejs/kit';
import { loadArticleBySlug } from '$lib/data/loadArticles';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const article = await loadArticleBySlug(params.slug, fetch);
	if (!article) error(404, 'Not found');
	return { article };
};
