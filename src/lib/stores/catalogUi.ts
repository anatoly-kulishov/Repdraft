import type { ExerciseFilters } from '$lib/domain/types';
import { writable } from 'svelte/store';

const PAGE_SIZE = 24;

export function emptyCatalogFilters(): ExerciseFilters {
	return {
		query: '',
		bodyPart: 'all',
		equipment: 'all',
		target: 'all'
	};
}

export type CatalogUiState = {
	visibleLimit: number;
};

function createCatalogUiStore() {
	const { subscribe, set, update } = writable<CatalogUiState>({
		visibleLimit: PAGE_SIZE
	});

	return {
		subscribe,
		setVisibleLimit(visibleLimit: number) {
			update((state) => ({ ...state, visibleLimit }));
		},
		reset() {
			set({ visibleLimit: PAGE_SIZE });
		}
	};
}

/** Catalog list chrome (pagination). Facets live in the URL, not here. */
export const catalogUi = createCatalogUiStore();
export const CATALOG_PAGE_SIZE = PAGE_SIZE;
