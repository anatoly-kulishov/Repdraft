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
	filters: ExerciseFilters;
	visibleLimit: number;
};

function createCatalogUiStore() {
	const { subscribe, set, update } = writable<CatalogUiState>({
		filters: emptyCatalogFilters(),
		visibleLimit: PAGE_SIZE
	});

	return {
		subscribe,
		setFilters(filters: ExerciseFilters) {
			update((state) => ({ ...state, filters: { ...filters } }));
		},
		setVisibleLimit(visibleLimit: number) {
			update((state) => ({ ...state, visibleLimit }));
		},
		reset() {
			set({ filters: emptyCatalogFilters(), visibleLimit: PAGE_SIZE });
		}
	};
}

/** Session memory for catalog filters while building a workout (survives exercise ↔ catalog). */
export const catalogUi = createCatalogUiStore();
export const CATALOG_PAGE_SIZE = PAGE_SIZE;
