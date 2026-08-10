import { BOOKMARKS_STORAGE_KEY, type BookmarkRepository } from '$lib/domain/repository';

function readIds(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))];
	} catch {
		return [];
	}
}

function writeIds(ids: string[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(ids));
}

export const localBookmarkRepository: BookmarkRepository = {
	async list() {
		return readIds();
	},

	async add(exerciseId: string) {
		const ids = readIds();
		if (ids.includes(exerciseId)) return;
		writeIds([exerciseId, ...ids]);
	},

	async remove(exerciseId: string) {
		writeIds(readIds().filter((id) => id !== exerciseId));
	}
};
