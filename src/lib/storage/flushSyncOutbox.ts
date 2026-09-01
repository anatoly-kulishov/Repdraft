import { CLOUD_REQUEST_MS } from '$lib/domain/networkTimeouts';
import { withTimeout } from '$lib/domain/withTimeout';
import { isCloudMode, isSessionsCloudAvailable } from '$lib/storage/dataAccess';
import { localRecordRepository } from '$lib/storage/localRecordRepository';
import { localSessionRepository } from '$lib/storage/localSessionRepository';
import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
import {
	listOutbox,
	removeOutboxEntry,
	type SyncOutboxEntry
} from '$lib/storage/syncOutbox';
import { supabaseRecordRepository } from '$lib/storage/supabaseRecordRepository';
import { supabaseSessionRepository } from '$lib/storage/supabaseSessionRepository';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';

const FLUSH_MS = CLOUD_REQUEST_MS;

let inflight: Promise<void> | null = null;

/**
 * Replay failed cloud mirrors when the network returns.
 * Local data is source of truth; failures leave entries in the outbox.
 */
export async function flushSyncOutbox(): Promise<void> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return;
	if (!isCloudMode()) return;
	if (inflight) return inflight;

	inflight = (async () => {
		const entries = listOutbox();
		for (const entry of entries) {
			try {
				await flushOne(entry);
				removeOutboxEntry(entry);
			} catch (err) {
				console.warn('sync outbox flush stalled', entry.kind, err);
				break;
			}
		}
	})().finally(() => {
		inflight = null;
	});

	return inflight;
}

async function flushOne(entry: SyncOutboxEntry): Promise<void> {
	switch (entry.kind) {
		case 'session.save': {
			if (!isSessionsCloudAvailable()) return;
			const session = await localSessionRepository.get(entry.id);
			if (!session) return;
			await withTimeout(supabaseSessionRepository.save(session), FLUSH_MS);
			return;
		}
		case 'session.delete': {
			if (!isSessionsCloudAvailable()) return;
			await withTimeout(supabaseSessionRepository.remove(entry.id), FLUSH_MS);
			return;
		}
		case 'plan.save': {
			const plan = await localWorkoutRepository.get(entry.id);
			if (!plan) return;
			await withTimeout(supabaseWorkoutRepository.save(plan), FLUSH_MS);
			return;
		}
		case 'plan.delete': {
			await withTimeout(supabaseWorkoutRepository.remove(entry.id), FLUSH_MS);
			return;
		}
		case 'record.save': {
			const record = await localRecordRepository.get(entry.exerciseId);
			if (!record) return;
			await withTimeout(supabaseRecordRepository.save(record), FLUSH_MS);
			return;
		}
		case 'record.delete': {
			await withTimeout(supabaseRecordRepository.remove(entry.exerciseId), FLUSH_MS);
			return;
		}
		default: {
			const _exhaustive: never = entry;
			return _exhaustive;
		}
	}
}
