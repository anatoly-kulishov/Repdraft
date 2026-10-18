import { SESSIONS_DELETED_KEY } from '@repdraft/domain/repository';
import { kvGetJson, kvSetJson, kvRemove } from '../storage/kv';

const MAX_TOMBSTONES = 500;

async function readIds(): Promise<string[]> {
	const list = await kvGetJson<string[]>(SESSIONS_DELETED_KEY, []);
	return Array.isArray(list) ? list.filter((id) => typeof id === 'string' && id.length > 0) : [];
}

async function writeIds(ids: string[]): Promise<void> {
	const unique = [...new Set(ids)].slice(-MAX_TOMBSTONES);
	if (unique.length === 0) {
		await kvRemove(SESSIONS_DELETED_KEY);
		return;
	}
	await kvSetJson(SESSIONS_DELETED_KEY, unique);
}

export async function listSessionTombstones(): Promise<string[]> {
	return readIds();
}

export async function addSessionTombstone(id: string): Promise<void> {
	const trimmed = id.trim();
	if (!trimmed) return;
	await writeIds([...(await readIds()), trimmed]);
}

export async function clearSessionTombstone(id: string): Promise<void> {
	await writeIds((await readIds()).filter((x) => x !== id));
}
