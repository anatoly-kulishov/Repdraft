import type { Exercise, ExerciseIndexItem } from '$lib/domain/types';

let indexPromise: Promise<ExerciseIndexItem[]> | null = null;
let fullPromise: Promise<Exercise[]> | null = null;
let fullMap: Map<string, Exercise> | null = null;

export function loadExerciseIndex(): Promise<ExerciseIndexItem[]> {
	if (!indexPromise) {
		indexPromise = fetch('/data/exercises.index.json')
			.then(async (res) => {
				if (!res.ok) {
					throw new Error('Не удалось загрузить каталог упражнений.');
				}
				return (await res.json()) as ExerciseIndexItem[];
			})
			.catch((err) => {
				indexPromise = null;
				throw err;
			});
	}
	return indexPromise;
}

export function loadAllExercises(): Promise<Exercise[]> {
	if (!fullPromise) {
		fullPromise = fetch('/data/exercises.json')
			.then(async (res) => {
				if (!res.ok) {
					throw new Error('Не удалось загрузить упражнения.');
				}
				const list = (await res.json()) as Exercise[];
				fullMap = new Map(list.map((ex) => [ex.id, ex]));
				return list;
			})
			.catch((err) => {
				fullPromise = null;
				fullMap = null;
				throw err;
			});
	}
	return fullPromise;
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
	await loadAllExercises();
	return fullMap?.get(id) ?? null;
}

export async function getIndexItemById(id: string): Promise<ExerciseIndexItem | null> {
	const index = await loadExerciseIndex();
	return index.find((item) => item.id === id) ?? null;
}
