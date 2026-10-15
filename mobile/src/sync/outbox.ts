import { isCloudPersistableId } from '@repdraft/domain/id';
import { kvGetJson, kvRemove, kvSetJson } from '../storage/kv';

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

async function readOutbox(): Promise<SyncOutboxEntry[]> {
	const raw = await kvGetJson<unknown[]>(SYNC_OUTBOX_KEY, []);
	return Array.isArray(raw) ? raw.filter(isOutboxEntry) : [];
}

async function writeOutbox(entries: SyncOutboxEntry[]): Promise<void> {
	if (entries.length === 0) {
		await kvRemove(SYNC_OUTBOX_KEY);
		return;
	}
	await kvSetJson(SYNC_OUTBOX_KEY, entries);
}

function shouldEnqueue(entry: SyncOutboxEntry): boolean {
	switch (entry.kind) {
		case 'session.save':
		case 'session.delete':
		case 'plan.save':
		case 'plan.delete':
			return isCloudPersistableId(entry.id);
		case 'record.save':
		case 'record.delete':
			return true;
		default: {
			const _exhaustive: never = entry;
			return _exhaustive;
		}
	}
}

export async function listOutbox(): Promise<SyncOutboxEntry[]> {
	return readOutbox();
}

export async function outboxCount(): Promise<number> {
	return (await readOutbox()).length;
}

export async function enqueueOutbox(entry: SyncOutboxEntry): Promise<void> {
	if (!shouldEnqueue(entry)) return;
	const key = entryKey(entry);
	const next = (await readOutbox()).filter((e) => entryKey(e) !== key);
	next.push(entry);
	await writeOutbox(next);
}

export async function dequeueOutbox(entry: SyncOutboxEntry): Promise<void> {
	const key = entryKey(entry);
	await writeOutbox((await readOutbox()).filter((e) => entryKey(e) !== key));
}
