import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Exercise } from '$lib/domain/types';

/**
 * Server-only catalog loaded from disk (not bundled into the JS chunk).
 * File is included in the Vercel function via adapter `includeFiles`.
 */
let byId: Map<string, Exercise> | null = null;

function catalog(): Map<string, Exercise> {
	if (byId) return byId;
	const path = join(process.cwd(), 'data/exercises.full.json');
	const list = JSON.parse(readFileSync(path, 'utf8')) as Exercise[];
	byId = new Map(list.map((ex) => [ex.id, ex]));
	return byId;
}

export function getExerciseById(id: string): Exercise | null {
	return catalog().get(id) ?? null;
}

export function listExerciseIds(): string[] {
	return [...catalog().keys()];
}
