import { SESSIONS_DELETED_KEY } from '$lib/domain/repository';

const MAX_TOMBSTONES = 500;

function readIds(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(SESSIONS_DELETED_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
	} catch {
		return [];
	}
}

function writeIds(ids: string[]): void {
	if (typeof localStorage === 'undefined') return;
	const unique = [...new Set(ids)].slice(-MAX_TOMBSTONES);
	if (unique.length === 0) {
		localStorage.removeItem(SESSIONS_DELETED_KEY);
		return;
	}
	localStorage.setItem(SESSIONS_DELETED_KEY, JSON.stringify(unique));
}

/** Session ids removed on this device — block cloud merge from resurrecting them. */
export function listSessionTombstones(): string[] {
	return readIds();
}

export function addSessionTombstone(id: string): void {
	const trimmed = id.trim();
	if (!trimmed) return;
	writeIds([...readIds(), trimmed]);
}

export function addSessionTombstones(ids: string[]): void {
	const next = ids.map((id) => id.trim()).filter(Boolean);
	if (next.length === 0) return;
	writeIds([...readIds(), ...next]);
}

export function clearSessionTombstone(id: string): void {
	writeIds(readIds().filter((x) => x !== id));
}
