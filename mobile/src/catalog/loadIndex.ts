import {
	customExerciseToIndexItem,
	type CustomExercise
} from '@repdraft/domain/customExercises';
import type { ExerciseIndexItem } from '@repdraft/domain/types';
import { customsRepo } from '../storage/customsRepo';

// Bundled slim catalog (~412KB). Full GIF payloads stay on web for now.
import indexJson from '../../assets/data/exercises.index.json';

let cachedCatalog: ExerciseIndexItem[] | null = null;
let customsCache: CustomExercise[] = [];

function catalogOnly(): ExerciseIndexItem[] {
	if (!cachedCatalog) {
		const raw = indexJson as ExerciseIndexItem[];
		cachedCatalog = Array.isArray(raw) ? raw : [];
	}
	return cachedCatalog;
}

/** Call on screen focus so custom names resolve after create/import. */
export async function refreshCustomsCache(): Promise<void> {
	customsCache = await customsRepo.list();
}

export function loadExerciseIndex(): ExerciseIndexItem[] {
	const customs = customsCache.map(customExerciseToIndexItem);
	return [...customs, ...catalogOnly()];
}

export function getIndexItem(id: string): ExerciseIndexItem | null {
	const custom = customsCache.find((ex) => ex.id === id);
	if (custom) return customExerciseToIndexItem(custom);
	return catalogOnly().find((ex) => ex.id === id) ?? null;
}

export function exerciseDisplayName(id: string, locale: 'ru' | 'en'): string {
	const item = getIndexItem(id);
	if (!item) return id.startsWith('demo-') ? id.replace('demo-', '') : id;
	if (locale === 'ru' && item.name_ru?.trim()) return item.name_ru.trim();
	return item.name;
}

export function filterExercises(
	items: ExerciseIndexItem[],
	opts: { query: string; bodyPart: string | 'all'; locale: 'ru' | 'en' }
): ExerciseIndexItem[] {
	const q = opts.query.trim().toLowerCase().replace(/ё/g, 'е');
	return items.filter((ex) => {
		if (opts.bodyPart !== 'all' && ex.body_part !== opts.bodyPart) return false;
		if (!q) return true;
		const hay = `${ex.name} ${ex.name_ru ?? ''} ${ex.target} ${ex.equipment}`
			.toLowerCase()
			.replace(/ё/g, 'е');
		return hay.includes(q);
	});
}

export function uniqueBodyParts(items: ExerciseIndexItem[]): string[] {
	return [...new Set(items.map((ex) => ex.body_part))].sort((a, b) => a.localeCompare(b, 'en'));
}
