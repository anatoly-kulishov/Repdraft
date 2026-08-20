export type SyncOutboxEntry =
	| { kind: 'session.save'; id: string }
	| { kind: 'session.delete'; id: string }
	| { kind: 'plan.save'; id: string }
	| { kind: 'plan.delete'; id: string }
	| { kind: 'record.save'; exerciseId: string }
	| { kind: 'record.delete'; exerciseId: string };

export const SYNC_OUTBOX_KEY = 'repdraft:sync-outbox';

function entryKey(entry: SyncOutboxEntry): string {
	switch (entry.kind) {
		case 'session.save':
		case 'session.delete':
		case 'plan.save':
		case 'plan.delete':
			return `${entry.kind}:${entry.id}`;
		case 'record.save':
		case 'record.delete':
			return `${entry.kind}:${entry.exerciseId}`;
		default: {
			const _exhaustive: never = entry;
			return _exhaustive;
		}
	}
}

export function listOutbox(): SyncOutboxEntry[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(SYNC_OUTBOX_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isOutboxEntry);
	} catch {
		return [];
	}
}

function isOutboxEntry(value: unknown): value is SyncOutboxEntry {
	if (!value || typeof value !== 'object') return false;
	const v = value as { kind?: string; id?: string; exerciseId?: string };
	switch (v.kind) {
		case 'session.save':
		case 'session.delete':
		case 'plan.save':
		case 'plan.delete':
			return typeof v.id === 'string' && v.id.length > 0;
		case 'record.save':
		case 'record.delete':
			return typeof v.exerciseId === 'string' && v.exerciseId.length > 0;
		default:
			return false;
	}
}

function writeOutbox(entries: SyncOutboxEntry[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		if (entries.length === 0) localStorage.removeItem(SYNC_OUTBOX_KEY);
		else localStorage.setItem(SYNC_OUTBOX_KEY, JSON.stringify(entries));
	} catch {
		/* ignore */
	}
}

/** Dedupe by kind+id; newer enqueue replaces older same key. */
export function enqueueOutbox(entry: SyncOutboxEntry): void {
	const key = entryKey(entry);
	const next = listOutbox().filter((e) => entryKey(e) !== key);
	next.push(entry);
	writeOutbox(next);
}

export function removeOutboxEntry(entry: SyncOutboxEntry): void {
	const key = entryKey(entry);
	writeOutbox(listOutbox().filter((e) => entryKey(e) !== key));
}

export function clearSyncOutbox(): void {
	writeOutbox([]);
}
