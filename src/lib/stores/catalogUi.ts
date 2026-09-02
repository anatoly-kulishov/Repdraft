import type { ExerciseFilters } from '$lib/domain/types';
import { writable } from 'svelte/store';

const PAGE_SIZE = 24;
/** Saved + records skeleton placeholders — mobile single column. */
export const EXERCISES_SUBROUTE_SKELETON_ROWS_MOBILE = 4;
/** Desktop grid (768px+, 2–3 cols) — two full rows without a dangling card. */
export const EXERCISES_SUBROUTE_SKELETON_ROWS_DESKTOP = 6;

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
