import { error } from '@sveltejs/kit';
import { isCatalogZone } from '$lib/domain/catalogLinks';
import { loadCatalogZone } from '$lib/data/loadCatalogPage';
import {
	PRERENDER_PUBLIC,
	catalogPrerenderEntries
} from '$lib/seo/prerenderPublic';
import type { PageLoad } from './$types';

export const prerender = PRERENDER_PUBLIC;

export function entries() {
	return catalogPrerenderEntries();
}

export const load: PageLoad = async ({ params, fetch }) => {
	const bodyPart = decodeURIComponent(params.bodyPart);
	if (bodyPart !== 'all' && !isCatalogZone(bodyPart)) {
		error(404, 'Not found');
	}

	const meta = await loadCatalogZone(fetch, bodyPart);
	// ponytail: prerender routes cannot read url.searchParams — filters hydrate client-side.
	return {
		bodyPart,
		initialQuery: '',
		initialEquipment: '',
		initialTarget: '',
		initialBodyPart: '',
		initialBrowse: '',
		...meta
	};
};
