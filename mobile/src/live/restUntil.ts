import { REST_UNTIL_STORAGE_KEY } from '@repdraft/domain/repository';
import { kvGet, kvRemove, kvSet } from '../storage/kv';

export async function readRestUntil(): Promise<number | null> {
	const raw = await kvGet(REST_UNTIL_STORAGE_KEY);
	if (!raw) return null;
	const n = Number(raw);
	return Number.isFinite(n) && n > Date.now() ? n : null;
}

export async function writeRestUntil(restUntil: number | null): Promise<void> {
	if (restUntil == null || restUntil <= Date.now()) await kvRemove(REST_UNTIL_STORAGE_KEY);
	else await kvSet(REST_UNTIL_STORAGE_KEY, String(restUntil));
}

export function restSecondsLeft(restUntil: number | null, now = Date.now()): number {
	if (restUntil == null) return 0;
	return Math.max(0, Math.ceil((restUntil - now) / 1000));
}
