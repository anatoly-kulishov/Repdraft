import {
	findDuplicateCustom,
	MAX_CUSTOM_EXERCISES,
	mergeCustomExercises,
	normalizeCustomExercise,
	parseStoredCustomExercises,
	sortCustomsNewest,
	type CustomExercise,
	type CustomExerciseDraft
} from '@repdraft/domain/customExercises';
import { CUSTOM_EXERCISES_STORAGE_KEY } from '@repdraft/domain/repository';
import { kvGetJson, kvSetJson } from './kv';

async function readAll(): Promise<CustomExercise[]> {
	const raw = await kvGetJson<unknown>(CUSTOM_EXERCISES_STORAGE_KEY, []);
	return parseStoredCustomExercises(raw);
}

export const customsRepo = {
	async list(): Promise<CustomExercise[]> {
		return sortCustomsNewest(await readAll());
	},

	async saveAll(items: CustomExercise[]): Promise<void> {
		await kvSetJson(CUSTOM_EXERCISES_STORAGE_KEY, sortCustomsNewest(items));
	},

	async create(draft: CustomExerciseDraft): Promise<{ ok: true; exercise: CustomExercise } | { ok: false; reason: string }> {
		const list = await readAll();
		if (list.length >= MAX_CUSTOM_EXERCISES) {
			return { ok: false, reason: 'limit' };
		}
		const made = normalizeCustomExercise(draft);
		if (!made) return { ok: false, reason: 'invalid' };
		if (findDuplicateCustom(list, made.name)) return { ok: false, reason: 'duplicate' };
		const next = sortCustomsNewest([made, ...list]);
		await kvSetJson(CUSTOM_EXERCISES_STORAGE_KEY, next);
		return { ok: true, exercise: made };
	},

	async remove(id: string): Promise<void> {
		await kvSetJson(
			CUSTOM_EXERCISES_STORAGE_KEY,
			(await readAll()).filter((ex) => ex.id !== id)
		);
	},

	async mergeImported(imported: CustomExercise[]): Promise<CustomExercise[]> {
		const merged = mergeCustomExercises(await readAll(), imported);
		await kvSetJson(CUSTOM_EXERCISES_STORAGE_KEY, merged);
		return merged;
	}
};
