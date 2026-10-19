import { REST_SEC } from '@repdraft/domain/inputLimits';
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

/** Shift an active rest end. Null when the timer would hit zero (same clamp as web). */
export function shiftRestUntil(
	restUntil: number,
	deltaSec: number,
	now = Date.now()
): number | null {
	const leftSec = Math.ceil((restUntil + deltaSec * 1000 - now) / 1000);
	if (leftSec <= 0) return null;
	const clamped = Math.min(REST_SEC.max, leftSec);
	return now + clamped * 1000;
}
