import { error } from '@sveltejs/kit';
import { loadArticleVariantsBySlug } from '$lib/data/loadArticles';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const variants = await loadArticleVariantsBySlug(params.slug, fetch);
	if (variants.length === 0) error(404, 'Not found');
	return { variants };
};
