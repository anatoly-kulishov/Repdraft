import { error } from '@sveltejs/kit';
import { isCatalogZone } from '$lib/domain/catalogLinks';
import { loadCatalogZone } from '$lib/data/loadCatalogPage';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch, url }) => {
	const bodyPart = decodeURIComponent(params.bodyPart);
	if (bodyPart !== 'all' && !isCatalogZone(bodyPart)) {
		error(404, 'Not found');
	}

	const meta = await loadCatalogZone(fetch, bodyPart);
	return {
		bodyPart,
		initialQuery: url.searchParams.get('q') ?? '',
		initialEquipment: url.searchParams.get('equipment') ?? '',
		initialTarget: url.searchParams.get('target') ?? '',
		initialBrowse: url.searchParams.get('browse') ?? '',
		...meta
	};
};
