import type { Exercise } from '$lib/domain/types';
// Direct JSON import stays in the SSR graph only (`$lib/server` is client-blocked).
// Do not use `?url` here - Vite would also emit the file into public static assets.
import catalogJson from '../../../data/exercises.full.json';

/**
 * Server-only full exercise catalog (instructions etc.).
 * Index for list/search stays in `static/data/exercises.index.json`.
 */
let byId: Map<string, Exercise> | null = null;

function catalog(): Map<string, Exercise> {
	if (byId) return byId;
	const list = catalogJson as Exercise[];
	byId = new Map(list.map((ex) => [ex.id, ex]));
	return byId;
}

export function getExerciseById(id: string): Exercise | null {
	return catalog().get(id) ?? null;
}

export function listExerciseIds(): string[] {
	return [...catalog().keys()];
}
