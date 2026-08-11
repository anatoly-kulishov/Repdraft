import type { PageLoad } from './$types';
import { loadCatalogHub } from '$lib/data/loadCatalogPage';

export const load: PageLoad = async ({ fetch }) => loadCatalogHub(fetch);
