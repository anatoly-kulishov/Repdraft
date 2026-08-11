import { error } from '@sveltejs/kit';
import { isBodyPart } from '$lib/domain/filters';
import { loadCatalogIndex } from '$lib/data/loadCatalogPage';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch, url }) => {
	const bodyPart = decodeURIComponent(params.bodyPart);
	if (bodyPart !== 'all' && !isBodyPart(bodyPart)) {
		error(404, 'Not found');
	}

	const meta = await loadCatalogIndex(fetch);
	return {
		bodyPart,
		initialQuery: url.searchParams.get('q') ?? '',
		initialEquipment: url.searchParams.get('equipment') ?? '',
		initialTarget: url.searchParams.get('target') ?? '',
		...meta
	};
};
