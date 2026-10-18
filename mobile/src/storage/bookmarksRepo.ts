import { BOOKMARKS_STORAGE_KEY } from '@repdraft/domain/repository';
import { kvGetJson, kvSetJson } from './kv';

async function readAll(): Promise<string[]> {
	const list = await kvGetJson<string[]>(BOOKMARKS_STORAGE_KEY, []);
	return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
}

export const bookmarksRepo = {
	async list(): Promise<string[]> {
		return readAll();
	},
	async has(exerciseId: string): Promise<boolean> {
		return (await readAll()).includes(exerciseId);
	},
	async toggle(exerciseId: string): Promise<boolean> {
		const list = await readAll();
		const idx = list.indexOf(exerciseId);
		if (idx >= 0) {
			list.splice(idx, 1);
			await kvSetJson(BOOKMARKS_STORAGE_KEY, list);
			return false;
		}
		list.unshift(exerciseId);
		await kvSetJson(BOOKMARKS_STORAGE_KEY, list);
		return true;
	}
};
