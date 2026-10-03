import { CUSTOM_EXERCISES_STORAGE_KEY } from '$lib/domain/repository';
import {
	MAX_CUSTOM_EXERCISES,
	findDuplicateCustom,
	parseStoredCustomExercises,
	type CustomExercise
} from '$lib/domain/customExercises';

function readAll(): CustomExercise[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(CUSTOM_EXERCISES_STORAGE_KEY);
		if (!raw) return [];
		return parseStoredCustomExercises(JSON.parse(raw) as unknown);
	} catch {
		return [];
	}
}

function writeAll(items: CustomExercise[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(CUSTOM_EXERCISES_STORAGE_KEY, JSON.stringify(items));
	} catch {
		/* Quota or private mode — caller toasts; data stays in memory this session. */
	}
}

export function peekLocalCustomExercises(): CustomExercise[] {
	return readAll();
}

/** Null = name duplicate, 'full' = cap reached, otherwise the stored item. */
export function addLocalCustomExercise(
	item: CustomExercise
): { ok: true; items: CustomExercise[] } | { ok: false; reason: 'duplicate' | 'full' | 'quota' } {
	const items = readAll();
	if (findDuplicateCustom(items, item.name)) return { ok: false, reason: 'duplicate' };
	if (items.length >= MAX_CUSTOM_EXERCISES) return { ok: false, reason: 'full' };
	const next = [item, ...items];
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(CUSTOM_EXERCISES_STORAGE_KEY, JSON.stringify(next));
		} catch {
			return { ok: false, reason: 'quota' };
		}
	}
	return { ok: true, items: next };
}

export function removeLocalCustomExercise(id: string): CustomExercise[] {
	const items = readAll();
	const removed = items.find((ex) => ex.id === id);
	const next = items.filter((ex) => ex.id !== id);
	writeAll(next);
	return removed ? [removed, ...next] : next;
}

export function restoreLocalCustomExercise(item: CustomExercise): CustomExercise[] {
	const items = readAll();
	if (items.some((ex) => ex.id === item.id)) return items;
	const next = [item, ...items].slice(0, MAX_CUSTOM_EXERCISES);
	writeAll(next);
	return next;
}

export function replaceAllCustomExercises(items: CustomExercise[]): void {
	writeAll(items);
}
