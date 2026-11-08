import { listEnArticleScreenshots } from '$lib/data/articleScreenshots.server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	return {
		enArticleScreenshots: listEnArticleScreenshots()
	};
};
